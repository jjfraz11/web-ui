from controllers import *


def test_context_menu():
    with signup_to_homedir() as filesystem:
        dir_name = guid()
        filesystem.mkdir(dir_name)
        filesystem.context_click_on_file(dir_name)
        assert filesystem.d.find_element_by_id('right-click-menu') is not None


def test_delete_folder():
    with signup_to_homedir() as filesystem:
        dir_name = guid()
        filesystem.mkdir(dir_name)
        assert filesystem.d.find_element_by_id(dir_name) is not None
        filesystem.delete_file(dir_name)
        assert len(filesystem.d.find_elements_by_id(dir_name)) == 0


def test_public_link_to_folder():
    with signup_to_homedir() as filesystem:
        dir_name = guid()
        filesystem.mkdir(dir_name)
        filesystem.public_link(dir_name)
        public_link = filesystem.d.find_element_by_id('public_link_'+dir_name)
        assert public_link
        # click it
        # public_link.click()
        # time.sleep(3)
        # assert filesystem.d.find_element_by_xpath(
        #     "//button[class='btn_pnavbar btn tour-path text()={}]'".format(dir_name))
        #
        #
        # # filesystem.find_element_by_xpath("//span[class='btn_pnavbar btn tour path'")
