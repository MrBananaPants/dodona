/**
 * This file was adapted from https://github.com/sidsbrmnn/scrollspy
 * under the MIT license
 **/
export class ScrollSpy {
    /**
    * Initialises a new {@code ScrollSpy} instance.
    * Supported options are:
    * {
    *  sectionSelector: string;
    *  targetSelector: string;
    *  offset: number;
    *  hrefAttribute: string;
    *  activeClass: string;
    * }
    *
    * @param {string|HTMLElement} menu - Selector to nav menu.
    * @param {Object} options - Options
    */
    constructor(menu = "#navMain", options = {}) {
        if (!menu) {
            throw new Error("First argument cannot be empty");
        }
        if (!(typeof menu === "string" || menu instanceof HTMLElement)) {
            throw new TypeError(
                "menu can be either string or an instance of HTMLElement"
            );
        }

        if (typeof options !== "object") {
            throw new TypeError("options can only be of type object");
        }

        const defaultOptions = {
            sectionSelector: "section",
            targetSelector: "a",
            offset: 0,
            hrefAttribute: "href",
            activeClass: "active",
        };

        this.menuList =
            menu instanceof HTMLElement ? menu : document.querySelector(menu);
        this.options = Object.assign({}, defaultOptions, options);
        this.sections = document.querySelectorAll(this.options.sectionSelector);
        this.currentActive = null;
    }

    /**
     * Activates the scroll listener
     */
    activate() {
        window.onload = () => this.onScroll();
        window.addEventListener("scroll", () => this.onScroll());
    }

    /**
    * Handles scroll by finding the section
    * and setting the active class name.
    *
    * @return {void}
    */
    onScroll() {
        const section = this.getCurrentSection();
        const menuItem = this.getCurrentMenuItem(section);

        if (menuItem && menuItem !== this.currentActive) {
            this.currentActive = menuItem;
            this.removeCurrentActive({ ignore: menuItem });
            this.setActive(menuItem);
        }
    }

    /**
    * Returns the section where the current
    * scroll position is.
    *
    * @return {HTMLElement}
    */
    getCurrentSection() {
        this.sections = document.querySelectorAll(this.options.sectionSelector);
        for (let i = 0; i < this.sections.length; i++) {
            /**
            * @type {HTMLElement}
            */
            const section = this.sections[i];
            // get the parent of the parent of the anchor
            const startAt = section.parentElement.parentElement.offsetTop;
            const endAt = startAt + section.parentElement.parentElement.offsetHeight;
            const currentPosition =
                (document.documentElement.scrollTop ||
                    document.body.scrollTop) + this.options.offset;
            const isInView = currentPosition >= startAt && currentPosition < endAt;
            if (isInView) {
                return section;
            }
        }
    }

    /**
    * Returns the menu item to which the
    * current scroll position is pointing to.
    *
    * @param {HTMLElement} section - The current section
    * @return {HTMLAnchorElement}
    */
    getCurrentMenuItem(section) {
        if (!section) {
            return;
        }

        const sectionId = section.getAttribute("id");
        return this.menuList.querySelector(
            `[${this.options.hrefAttribute}="#${sectionId}"]`
        );
    }

    /**
    * Adds active class to the passed element.
    *
    * @param {HTMLAnchorElement} menuItem - Menu item of current section.
    * @return {void}
    */
    setActive(menuItem) {
        const isActive = menuItem.classList.contains(this.options.activeClass);
        if (!isActive) {
            const activeClasses = this.options.activeClass.trim().split(" ");
            activeClasses.forEach(activeClass =>
                menuItem.classList.add(activeClass)
            );
        }
    }

    /**
    * Removes active class from all nav links
    *
    * @return {void}
    */
    removeCurrentActive() {
        const { targetSelector } = this.options;
        const menuItems = this.menuList.querySelectorAll(targetSelector);

        menuItems.forEach(item => {
            const activeClasses = this.options.activeClass.trim().split(" ");
            activeClasses.forEach(activeClass =>
                item.classList.remove(activeClass)
            );
        });
    }
}
