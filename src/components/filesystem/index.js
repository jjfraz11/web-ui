module.exports = {
    template: require('filesystem.html'),
    data: function() {
        return {
            context: null,
            contextUpdates: 0,
            path: [],
            currentDir: null,
	        files: [],
            followerNames: [],
            grid: true,
            sortBy: "name",
            normalSortOrder: true,
            clipboard:{},
            selectedFiles:[],
            url:null,
            viewMenu:false,
            ignoreEvent:false,
            top:"0px",
            left:"0px",
            showModal:false,
            modalTitle:"",
            modalLinks:[],
            showShare:false,
            showSharedWith:false,
            sharedWithData:{},
	    forceSharedWithUpdate:0,
	    isNotBackground: true,
            showSocial:false,
            showGallery:false,
            showHexViewer:false,
            showTextViewer:false,
            showPassword:false,
            showSettingsMenu:false,
	    social:{
		pending: [],
                followers: [],
                following: []
	    },
            messages: [],
            progressMonitors: [],
            clipboardAction:"",
            forceUpdate:0,
            externalChange:0,
            prompt_message: '',
            prompt_placeholder: '',
	        prompt_value: '',
            showPrompt: false,
            errorTitle:'',
            errorBody:'',
            showError:false,
            showSpinner: true,
            initiateDownload: false, // used to trigger a download for a public link to a file
	    onUpdateCompletion: [] // methods to invoke when current dir is next refreshed
        };
    },
    props: {
    },
    created: function() {
        console.debug('Filesystem module created!');
    },
    watch: {
        // manually encode currentDir dependencies to get around infinite dependency chain issues with async-computed methods
        context: function(newContext) {
            this.contextUpdates++;
            this.updateCurrentDir();
            this.updateFollowerNames();
        },

        path: function(newPath) {
            this.updateCurrentDir();
        },

        forceSharedWithUpdate: function(newCounter) {
            this.sharedWithDataUpdate();
            this.updateCurrentDir();
        },
        forceUpdate: function(newUpdateCounter) {
            this.updateCurrentDir();
        },

	externalChange: function(newExternalChange) {
	    this.updateSocial();
	},

	files: function(newFiles) {
	    console.log("files")
	    
	    if (newFiles == null)
		return;
	    
	    if (this.files == null && newFiles != null)
		return this.processPending();

	    if (this.files.length != newFiles.length) {
		this.processPending();
	    } else {
		for (var i=0; i < this.files.length; i++)
		    if (! this.files[i].equals(newFiles[i]))
			return this.processPending();
	    }
	}
    },
    methods: {
	processPending: function() {
	    for (var i=0; i < this.onUpdateCompletion.length; i++) {
		this.onUpdateCompletion[i].call();
	    }
	    this.onUpdateCompletion = [];
	},
	
        updateCurrentDir: function() {
            var context = this.getContext();
            if (context == null)
                return Promise.resolve(null);
            var x = this.forceUpdate;
            var path = this.getPath();
            var that = this;
            context.getByPath(path).thenApply(function(file){
                that.currentDir = file.get();
		that.updateFiles();
            });
        },
	
        updateFiles: function() {
            var current = this.currentDir;
            if (current == null)
                return Promise.resolve([]);
            var that = this;
            current.getChildren(that.getContext().network).thenApply(function(children){
                var arr = children.toArray();
                that.showSpinner = false;
                that.files = arr.filter(function(f){
                    return !f.getFileProperties().isHidden;
                });
            });
        },

	updateSocial: function() {
	    var context = this.getContext();
            if (context == null || context.username == null)
                this.social = {
                    pending: [],
                    followers: [],
                    following: []
                };
	    else {
		var that = this;
                context.getSocialState().thenApply(function(social){
		    that.social = {
                        pending: social.pendingIncoming.toArray([]),
                        followers: social.followerRoots.keySet().toArray([]),
                        following: social.followingRoots.toArray([]).map(function(f){return f.getFileProperties().name}),
                        pendingOutgoing: social.pendingOutgoingFollowRequests.keySet().toArray([])
		    };
                });
	    }
	},

        updateFollowerNames: function() {
            var context = this.getContext();
            if (context == null || context.username == null)
                return Promise.resolve([]);
            var that = this;
            context.getFollowerNames().thenApply(function(usernames){
                that.followerNames = usernames.toArray([]);
            });
        },
        sharedWithDataUpdate: function() {
            var context = this.getContext();
            if (this.selectedFiles.length != 1 || context == null) {
                that.sharedWithData = {title:'', shared_with_users:[] };
            }
            var file = this.selectedFiles[0];
            var that = this;
            context.sharedWith(file).thenApply(function(usernames){
                var unames = usernames.toArray([]);
                var filename = file.getFileProperties().name;
                var title = filename + " is shared with:";
                that.sharedWithData = {title:title, shared_with_users:unames};
            });
        },
        getContext: function() {
            var x = this.contextUpdates;
            return this.context;
        },

        getThumbnailURL: function(file) {
            return file.getBase64Thumbnail();
        },
        goBackToLevel: function(level) {
            // By default let's jump to the root.
            var newLevel = level || 0,
            path = this.path.slice(0, newLevel).join('/');

            if (newLevel < this.path.length) {
                this.changePath(path);
            }
        },

        goHome: function() {
            this.changePath("/");
        },

        askMkdir: function() {
            this.prompt_placeholder='Folder name';
            this.prompt_message='Enter a new folder name';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
                console.log("creating new sub-dir "+ prompt_result);
                if (prompt_result === '')
                    return;
                this.mkdir(prompt_result);
            }.bind(this);
            this.showPrompt =  true;
        },

        switchView: function() {
            this.grid = !this.grid;
        },

        currentDirChanged: function() {
            // force reload of computed properties
            this.forceUpdate++;
        },

        mkdir: function(name) {
            var context = this.getContext();
            this.showSpinner = true;
            var that = this;

            this.currentDir.mkdir(name, context.network, false, context.crypto.random)
                .thenApply(function(x){
                    this.currentDirChanged();
		    that.onUpdateCompletion.push(function() {
                        that.showSpinner = false;
		    });
                }.bind(this)).exceptionally(function(throwable) {
		    that.errorTitle = 'Error creating directory: ' + name;
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
		});
        },

        askForFile: function() {
            console.log("ask for file");
            document.getElementById('uploadInput').click();
        },
        dndDrop: function(evt) {
            evt.preventDefault();
            console.log("upload files from DnD");
            let items = evt.dataTransfer.items;
            let that = this;
            for(let i =0; i < items.length; i++){
                let entry = items[i].webkitGetAsEntry();
                if(entry != null) {
                    this.getEntriesAsPromise(entry, that);
                }
            }
        },
        getEntriesAsPromise: function(item, that) {
            return new Promise(function(resolve, reject){
                if(item.isDirectory){
                    /* disabled until fix for uploading into a directory structure is done
                       let reader = item.createReader();
                       let doBatch = function() {
                       reader.readEntries(function(entries) {
                       if (entries.length > 0) {
                       entries.forEach(function(entry){
                       that.getEntriesAsPromise(entry, that);
                       });
                       doBatch();
                       } else {
                       resolve();
                       }
                       }, reject);
                       };
                       doBatch();*/
                }else{
                    item.file(function(item){that.uploadFile(item);}, function(e){console.log(e);});
                }
            });
        },
        uploadFiles: function(evt) {
            console.log("upload files");
            var files = evt.target.files || evt.dataTransfer.files;
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
                this.uploadFile(file);
            }
        },
        uploadFile: function(file) {
            console.log("uploading " + file.name);
            var resultingSize = file.size;
            var progress = {
                show:true,
                title:"Uploading " + file.name,
                done:0,
                max:resultingSize
            };
            this.progressMonitors.push(progress);
            var reader = new browserio.JSFileReader(file);
            var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            var that = this;
            var context = this.getContext();
            this.currentDir.uploadFileJS(file.name, java_reader, 0, file.size, false, context.network, context.crypto.random, function(len){
                progress.done += len.value_0;
                if (progress.done >= progress.max) {
                    setTimeout(function(){progress.show = false}, 2000);
                    that.showSpinner = true;	
                }
            }, context.fragmenter()).thenApply(function(x) {
                that.currentDirChanged();
            }).exceptionally(function(throwable) {
		progress.show = false;
                that.errorTitle = 'Error uploading file: ' + file.name;
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },

        toggleUserMenu: function() {
            this.showSettingsMenu = !this.showSettingsMenu;
        },

        showChangePassword: function() {
            this.toggleUserMenu();
            this.showPassword = true;
        },

        logout: function() {
            this.toggleUserMenu();
            this.context = null;
            window.location.reload();
        },

        showMessage: function(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },

        showSocialView: function(name) {
            this.showSocial = true;
            this.externalChange++;
        },

        copy: function() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];

            this.clipboard = {
                fileTreeNode: file,
                op: "copy"
            };
            this.closeMenu();
        },

        cut: function() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];

            this.clipboard = {
                parent: this.currentDir,
                fileTreeNode: file,
                op: "cut"
            };
            this.closeMenu();
        },

        paste: function() {
            if (this.selectedFiles.length != 1)
                return;
            var target = this.selectedFiles[0];
            var that = this;

            if(target.isDirectory()) {
                let clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;

                if(clipboard.fileTreeNode.equals(target)) {
                    return;
                }
                that.showSpinner = true;

                var context = this.getContext();
                if (clipboard.op == "cut") {
                    console.log("paste-cut "+clipboard.fileTreeNode.getFileProperties().name + " -> "+target.getFileProperties().name);
                    clipboard.fileTreeNode.copyTo(target, context.network, context.crypto.random, context.fragmenter()).thenCompose(function() {
                        return clipboard.fileTreeNode.remove(that.getContext().network, clipboard.parent);
                    }).thenApply(function() {
                        that.currentDirChanged();
			that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
			});
                    }).exceptionally(function(throwable) {
			that.errorTitle = 'Error moving file';
			that.errorBody = throwable.getMessage();
			that.showError = true;
			that.showSpinner = false;
		    });
                } else if (clipboard.op == "copy") {
                    console.log("paste-copy");
                    clipboard.fileTreeNode.copyTo(target, context.network, context.crypto.random, context.fragmenter())
                        .thenApply(function() {
                            that.currentDirChanged();
			    that.onUpdateCompletion.push(function() {
				that.showSpinner = false;
			    });
                        }).exceptionally(function(throwable) {
			    that.errorTitle = 'Error copying file';
			    that.errorBody = throwable.getMessage();
			    that.showError = true;
			    that.showSpinner = false;
			});
                }
                this.clipboard.op = null;
            }

            this.closeMenu();
        },

        showShareWith: function() {
            if (this.selectedFiles.length == 0)
                return;
            this.closeMenu();
            this.showShare = true;
        },

        sharedWith: function() {
            if (this.selectedFiles.length == 0)
                return;
            if (this.selectedFiles.length != 1)
                return;
            this.closeMenu();
            var file = this.selectedFiles[0];
            var that = this;
            this.getContext().sharedWith(file)
                .thenApply(function(usernames) {
                    var unames = usernames.toArray([]);
                    var filename = file.getFileProperties().name;
                    var title = filename + " is shared with:";
                    that.sharedWithData = {title:title, shared_with_users:unames};
                    that.showSharedWith = true;
                });
        },

        setSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
        },

        changePassword: function(oldPassword, newPassword) {
            console.log("Changing password");
            this.showSpinner = true;
            var that = this;
            this.getContext().changePassword(oldPassword, newPassword).thenApply(function(newContext){
                this.contextUpdates++;
                this.context = newContext;
                this.showMessage("Password changed!");
                that.onUpdateCompletion.push(function() {
                    that.showSpinner = false;
                });
            }.bind(this));
        },

        changePath: function(path) {
            console.debug('Changing to path:'+ path);
            if (path.startsWith("/"))
                path = path.substring(1);
            this.path = path ? path.split('/') : [];
            this.showSpinner = true;
        },

        createPublicLink: function() {
            if (this.selectedFiles.length == 0)
                return;

            this.closeMenu();
            var links = [];
            for (var i=0; i < this.selectedFiles.length; i++) {
                var file = this.selectedFiles[i];
                var name = file.getFileProperties().name;
                links.push({href:window.location.origin + file.toLink(), 
                    name:name, 
                    id:'public_link_'+name});
            }
            var title = links.length > 1 ? "Public links to files: " : "Public link to file: ";
            this.showLinkModal(title, links);
        },

        showLinkModal: function(title, links) {
            this.showModal = true;
            this.modalTitle = title;
            this.modalLinks = links;
        },

        downloadAll: function() {
            if (this.selectedFiles.length == 0)
                return;
            this.closeMenu();
            for (var i=0; i < this.selectedFiles.length; i++) {
                var file = this.selectedFiles[i];
                this.navigateOrDownload(file);
            }    
        },

        gallery: function() {
            // TODO: once we support selecting files re-enable this
            //if (this.selectedFiles.length == 0)
            //    return;
            this.closeMenu();
	    if (this.selectedFiles.length == 0)
		return;
	    var mimeType = this.selectedFiles[0].getFileProperties().mimeType;
	    console.log("Opening " + mimeType);
	    if (mimeType.startsWith("audio") ||
		mimeType.startsWith("video") ||
		mimeType.startsWith("image"))
		this.showGallery = true;
	    else if (mimeType === "application/octet-stream") {
		this.showHexViewer = true;
	    } else if (mimeType === "text/plain") {
		this.showTextViewer = true;
	    }
        },

	navigateOrDownload: function(file) {
            if (this.showSpinner) // disable user input whilst refreshing
                return;
            this.closeMenu();
            if (file.isDirectory())
                this.navigateToSubdir(file.getFileProperties().name);
            else
                this.downloadFile(file);
        },

        navigateToSubdir: function(name) {
            this.changePath(this.getPath() + name);
        },

        downloadFile: function(file) {
            console.log("downloading " + file.getFileProperties().name);
            var props = file.getFileProperties();
            var that = this;
            var resultingSize = props.sizeLow();
            var progress = {
                show:true,
                title:"Downloading " + props.name,
                done:0,
                max:resultingSize
            };
            var that = this;
            this.progressMonitors.push(progress);
            var context = this.getContext();
            file.getInputStream(context.network, context.crypto.random, props.sizeHigh(), props.sizeLow(), function(read) {
                progress.done += read.value_0;
                if (progress.done >= progress.max)
                    setTimeout(function(){progress.show = false}, 2000);
            }).thenCompose(function(reader) {
                if(that.supportsStreaming()) {
                    var size = props.sizeLow();
                    var maxBlockSize = 1024 * 1024 * 5;
                    var blockSize = size > maxBlockSize ? maxBlockSize : size;

                    console.log("saving data of length " + size + " to " + props.name);
                           let fileStream = streamSaver.createWriteStream(props.name
                                , function(url){
                                    let link = document.createElement('a')
                                    let click = new MouseEvent('click')
                                            
                                    link.href = url
                                    link.dispatchEvent(click)                                          
                            })
                        let writer = fileStream.getWriter()
                        let pump = () => {
                            if(blockSize == 0) {
                                writer.close()
                            } else {
                                var data = convertToByteArray(new Uint8Array(blockSize));
                                data.length = blockSize;
                                reader.readIntoArray(data, 0, blockSize)
                                    .thenApply(function(read){
                                        size = size - read;
                                        blockSize = size > maxBlockSize ? maxBlockSize : size;
                                        writer.write(data).then(()=>{setTimeout(pump)})
                                    });
                            }
                        }
                    pump()
                } else {
                    var data = convertToByteArray(new Int8Array(props.sizeLow()));
                    data.length = props.sizeLow();
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){that.openItem(props.name, data)});
                }
            }).exceptionally(function(throwable) {
		progress.show = false;
                that.errorTitle = 'Error downloading file: ' + props.name;
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },
        supportsStreaming: function() {
	    var href = window.location.href;
	    if (href.indexOf("streaming=true") == -1)
		return false;
            try {
                return 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
            } catch(err) {
                return false;
            }
        },
        openItem: function(name, data) {
            console.log("saving data of length " + data.length + " to " + name);
            if(this.url != null){
                window.URL.revokeObjectURL(this.url);
            }

            var blob =  new Blob([data], {type: "octet/stream"});
            this.url = window.URL.createObjectURL(blob);
            var link = document.getElementById("downloadAnchor");
            link.href = this.url;
            link.download = name;
            link.click();
        },

        getPath: function() {
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        },

        dragStart: function(ev, treeNode) {
            console.log("dragstart");

            ev.dataTransfer.effectAllowed='move';
            var id = ev.target.id;
            ev.dataTransfer.setData("text/plain", id);
            var owner = treeNode.getOwner();
            var me = this.username;
            if (owner === me) {
                console.log("cut");
                this.clipboard = {
                    parent: this.currentDir,
                    fileTreeNode: treeNode,
                    op: "cut"
                };
            } else {
                console.log("copy");
                ev.dataTransfer.effectAllowed='copy';
                this.clipboard = {
                    fileTreeNode: treeNode,
                    op: "copy"
                };
            }
        },

        // DragEvent, FileTreeNode => boolean
        drop: function(ev, target) {
            console.log("drop");
            ev.preventDefault();
            var moveId = ev.dataTransfer.getData("text");
            var id = ev.target.id;
            var that = this;
            if(id != moveId && target.isDirectory()) {
                const clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;
                that.showSpinner = true;
                var context = this.getContext();
                if (clipboard.op == "cut") {
		    var name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("drop-cut " + name + " -> "+target.getFileProperties().name);
                    clipboard.fileTreeNode.copyTo(target, context.network, context.crypto.random, context.fragmenter()).thenCompose(function() {
                        return clipboard.fileTreeNode.remove(that.getContext().network, clipboard.parent);
                    }).thenApply(function() {
                        that.currentDirChanged();
			that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
			});
                    }).exceptionally(function(throwable) {
			that.errorTitle = 'Error moving file';
			that.errorBody = throwable.getMessage();
			that.showError = true;
			that.showSpinner = false;
		    });
                } else if (clipboard.op == "copy") {
                    console.log("drop-copy");
		    var file = clipboard.fileTreeNode;
		    var props = file.getFileProperties();
                    file.copyTo(target, context.network, context.crypto.random, context.fragmenter())
                        .thenApply(function() {
                            that.currentDirChanged();
			    that.onUpdateCompletion.push(function() {
				that.showSpinner = false;
			    });
                        }).exceptionally(function(throwable) {
			    that.errorTitle = 'Error copying file';
			    that.errorBody = throwable.getMessage();
			    that.showError = true;
			    that.showSpinner = false;
			});
                }
            }
        },

        openMenu: function(e, file) {
            if (this.ignoreEvent) {
                e.preventDefault();
                return;
            }

            if (this.showSpinner) {// disable user input whilst refreshing
                e.preventDefault();
                return;
            }
            if (this.getPath() == "/") {
                e.preventDefault();
                return; // disable sharing your root directory
            }
            if(file) {
		this.isNotBackground = true;
                this.selectedFiles = [file];
            } else {
		this.isNotBackground = false;
                this.selectedFiles = [this.currentDir];
            }
            this.viewMenu = true;

            Vue.nextTick(function() {
                var menu = document.getElementById("right-click-menu");
		if (menu != null)
		    menu.focus();
                this.setMenu(e.y, e.x)
            }.bind(this));
            e.preventDefault();
        },

        rename: function() {
            if (this.selectedFiles.length == 0)
                return;
            if (this.selectedFiles.length > 1)
                throw "Can't rename more than one file at once!";

            var file = this.selectedFiles[0];
            var old_name =  file.getFileProperties().name
                this.closeMenu();

            this.prompt_placeholder = 'New name';
	        this.prompt_value = old_name;
            this.prompt_message = 'Enter a new name';
            var that = this;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === '')
                    return;
                that.showSpinner = true;
                console.log("Renaming " + old_name + "to "+ prompt_result);
                file.rename(prompt_result, that.getContext().network, that.currentDir)
                    .thenApply(function(b){
                        that.currentDirChanged();
			that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
			});
                    }).exceptionally(function(throwable) {
			that.errorTitle = 'Error renaming file: ' + old_name;
			that.errorBody = throwable.getMessage();
			that.showError = true;
			that.showSpinner = false;
		    });
            };
            this.showPrompt =  true;
        },

        delete: function() {
            var selectedCount = this.selectedFiles.length;
            if (selectedCount == 0)
                return;
            this.closeMenu();

            var delete_countdown = {
                value: selectedCount
            };

            for (var i=0; i < selectedCount; i++) {
                var file = this.selectedFiles[i];
                console.log("deleting: " + file.getFileProperties().name);
                this.showSpinner = true;
                var that = this;
                file.remove(this.getContext().network, this.currentDir)
                    .thenApply(function(b){
                        that.currentDirChanged();
                        delete_countdown.value -=1;
                        if (delete_countdown.value == 0)
			    that.onUpdateCompletion.push(function() {
				that.showSpinner = false;
			    });
                    }).exceptionally(function(throwable) {
			that.errorTitle = 'Error deleting file: ' + file.getFileProperties().name;
			that.errorBody = throwable.getMessage();
			that.showError = true;
			that.showSpinner = false;
		    });
            }
        },
        setStyle: function(id, style) {
            var el = document.getElementById(id);
            if (el) {
                el.style.display = style;
            }
        },
        setMenu: function(top, left) {
            console.log("open menu");

            if (this.isNotBackground) {
                this.ignoreEvent = true;
            }

	    var menu = document.getElementById("right-click-menu");
	    if (menu != null) {
		var largestHeight = window.innerHeight - menu.offsetHeight - 25;
		var largestWidth = window.innerWidth - menu.offsetWidth - 25;
		
		if (top > largestHeight) top = largestHeight;
		
		if (left > largestWidth) left = largestWidth;
		
		this.top = top + 'px';
		this.left = left + 'px';
	    }
        },

        isShared: function(file) {

            if (this.currentDir == null)
                return false;

            var owner = this.currentDir.getOwner();
            var me = this.username;
            if (owner === me) {
                var result = this.getContext().isShared(file);
                return result;
            } else {
                return false;
            }
        },
        closeMenu: function() {
            this.viewMenu = false;
            this.ignoreEvent = false;
        }
    },
    computed: {
        sortedFiles: function() {
            if (this.files == null) {
                return [];
            }
            var sortBy = this.sortBy;
            var reverseOrder = ! this.normalSortOrder;
            return this.files.slice(0).sort(function(a, b) {
                var aVal, bVal;
                if (sortBy == null)
                    return 0;
                if (sortBy == "name") {
                    aVal = a.getFileProperties().name;
                    bVal = b.getFileProperties().name;
                } else if (sortBy == "size") {
                    aVal = a.getFileProperties().sizeLow();
                    bVal = b.getFileProperties().sizeLow();
                } else if (sortBy == "modified") {
                    aVal = a.getFileProperties().modified;
                    bVal = b.getFileProperties().modified;
                } else if (sortBy == "type") {
                    aVal = a.isDirectory();
                    bVal = b.isDirectory();
                } else
                    throw "Unknown sort type " + sortBy;

                if (a.isDirectory() !== b.isDirectory()) {
                    if (a.isDirectory()) {
                        return reverseOrder ? 1 : -1;
                    } else {
                        return reverseOrder ? -1 : 1;
                    }
                } else {
                    if (aVal < bVal) {
                        return reverseOrder ? 1 : -1;
                    } else if (aVal == bVal) {
                        return 0;
                    } else {
                        return reverseOrder ? -1 : 1;
                    }
                }
            });
        },
        canOpen: function() {
           try {
               if (this.currentDir == null)
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               return !this.selectedFiles[0].isDirectory()
           } catch (err) {
               return false;
           }
        },
        isWritable: function() {
            try {
                if (this.currentDir == null)
                    return false;
                return this.currentDir.isWritable();
            } catch (err) {
                return false;
            }
        },

        isNotHome: function() {
            return this.path.length > 1;
        },

        isNotMe: function() {
            if (this.currentDir == null)
                return true;

            var owner = this.currentDir.getOwner();
            var me = this.username;
            if (owner === me) {
                return false;
            }
            return true;
        },
        isPasteAvailable: function() {
            if (this.currentDir == null)
                return false;

            if (typeof(this.clipboard) ==  undefined || this.clipboard.op == null || typeof(this.clipboard.op) == "undefined")
                return false;

            if (this.selectedFiles.length != 1)
                return false;
            var target = this.selectedFiles[0];

            if(this.clipboard.fileTreeNode.equals(target)) {
                return false;
            }

            return this.currentDir.isWritable() && target.isDirectory();
        },

        username: function() {
            var context = this.getContext();
            if (context == null)
                return "";
            return context.username;
        }
    },
    events: {
        'parent-msg': function (msg) {
            // `this` in event callbacks are automatically bound
            // to the instance that registered it
            this.context = msg.context;
            this.contextUpdates++;
            this.initiateDownload = msg.download;
            const that = this;
            if (this.context.username == null) {
                // from a public link
                this.context.getEntryPath().thenApply(function(linkPath) {
                    that.changePath(linkPath);
                    Vue.nextTick(function() {
                        that.showGallery = msg.open;
                    });
                    if (that.initiateDownload) {
                        that.context.getByPath(that.getPath())
                            .thenApply(function(file){file.get().getChildren(that.context.network).thenApply(function(children){
                                var arr = children.toArray();
                                if (arr.length == 1)
                                    that.downloadFile(arr[0]);
                            })});
                    }
                });
            } else {
                this.updateSocial();
            }
        }
    }
};
