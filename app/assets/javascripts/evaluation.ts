import { fetch } from "util.js";

export function initCheckboxes(): void {
    document.querySelectorAll<HTMLTableRowElement>(".evaluation-users-table .user-row")
        .forEach(el => initCheckbox(el));
}

export function initCheckbox(row: HTMLTableRowElement): void {
    const checkbox = row.querySelector(".form-check-input") as HTMLInputElement;
    checkbox.addEventListener("change", async function () {
        const url = checkbox.getAttribute("data-url");
        const confirmMessage = checkbox.getAttribute("data-confirm");
        if (!confirmMessage || confirm(confirmMessage)) {
            const response = await fetch(url, { method: "POST" });
            eval(await response.text());
        } else {
            // There are no cancelable events for checkbox input, so cancel manually afterwards
            checkbox.checked = !checkbox.checked;
        }
    });
}

export function initAnonymizeButtons(): void {
    const yesButtonAnonymize = document.querySelector<HTMLElement>("#yes-anonymize");
    const noButtonAnonymize = document.querySelector<HTMLElement>("#no-anonymize");

    yesButtonAnonymize.addEventListener("click", function () {
        noButtonAnonymize.classList.remove("chosen-option");
        yesButtonAnonymize.classList.add("chosen-option");
        // display "yes" as answer next to the question rule
        document.querySelector<HTMLElement>("#choice-panel-anonymize .answer").innerText = yesButtonAnonymize.dataset["answer"];
    });

    document.querySelector("#no-anonymize").addEventListener("click", function () {
        yesButtonAnonymize.classList.remove("chosen-option");
        noButtonAnonymize.classList.add("chosen-option");
        // display "no" as answer next to the question rule
        document.querySelector<HTMLElement>("#choice-panel-anonymize .answer").innerText = noButtonAnonymize.dataset["answer"];
        // TODO: do something that saves we pressed no
    });
}

export function initEvaluationStepper(): void {
    const evalPanelElement = document.querySelector("#info-panel .panel-collapse");
    const evalPanel = new bootstrap.Collapse(evalPanelElement, { toggle: false });
    const userPanelElement = document.querySelector("#users-panel .panel-collapse");
    const userPanel = new bootstrap.Collapse(userPanelElement, { toggle: false });
    const anonymizeChoicePanelElement = document.querySelector("#choice-panel-anonymize .panel-collapse");
    const anonymizeChoicePanel = new bootstrap.Collapse(anonymizeChoicePanelElement, { toggle: false });
    const gradeChoicePanelElement = document.querySelector("#choice-panel-grading .panel-collapse");
    const gradeChoicePanel = new bootstrap.Collapse(gradeChoicePanelElement, { toggle: false });
    const scorePanelElement = document.querySelector("#items-panel .panel-collapse");
    const scorePanel = new bootstrap.Collapse(scorePanelElement, { toggle: false });

    let evaluationUrl: string = null;

    function init(): void {
        window.dodona.toUsersStep = toUsersStep;
        window.dodona.setEvaluationUrl = url => {
            evaluationUrl = url;
        };

        evalPanelElement.addEventListener("show.bs.collapse", function () {
            userPanel.hide();
            gradeChoicePanel.hide();
            scorePanel.hide();
            anonymizeChoicePanel.hide();
        });
        userPanelElement.addEventListener("show.bs.collapse", function () {
            evalPanel.hide();
            gradeChoicePanel.hide();
            scorePanel.hide();
            anonymizeChoicePanel.hide();
        });
        anonymizeChoicePanelElement.addEventListener("show.bs.collapse", function () {
            evalPanel.hide();
            gradeChoicePanel.hide();
            userPanel.hide();
            scorePanel.hide();
        });
        gradeChoicePanelElement.addEventListener("show.bs.collapse", function () {
            evalPanel.hide();
            userPanel.hide();
            scorePanel.hide();
            anonymizeChoicePanel.hide();
        });
        scorePanelElement.addEventListener("show.bs.collapse", function () {
            evalPanel.hide();
            gradeChoicePanel.hide();
            userPanel.hide();
            anonymizeChoicePanel.hide();
        });

        document.querySelector("#users-step-finish-button").addEventListener("click", function () {
            userPanel.hide();
            anonymizeChoicePanel.show();
            document.querySelector("#short-users-count-wrapper").classList.remove("hidden");
        });

        const yesButtonAnonymize = document.querySelector<HTMLElement>("#yes-anonymize");
        yesButtonAnonymize.addEventListener("click", function () {
            anonymizeChoicePanel.hide();
            gradeChoicePanel.show();
            // make the selected button a different shade
            noButtonAnonymize.classList.remove("chosen-option");
            yesButtonAnonymize.classList.add("chosen-option");
            // display "yes" as answer next to the question rule
            document.querySelector<HTMLElement>("#choice-panel-anonymize .answer").innerText = yesButtonAnonymize.dataset["answer"];
        });

        const noButtonAnonymize = document.querySelector<HTMLElement>("#no-anonymize");
        document.querySelector("#no-anonymize").addEventListener("click", function () {
            anonymizeChoicePanel.hide();
            // make the selected button a different shade
            yesButtonAnonymize.classList.remove("chosen-option");
            noButtonAnonymize.classList.add("chosen-option");
            // display "no" as answer next to the question rule
            document.querySelector<HTMLElement>("#choice-panel-anonymize .answer").innerText = noButtonAnonymize.dataset["answer"];
            // TODO: do something that saves we pressed no
            gradeChoicePanel.show();
        });

        const yesButtonGrading = document.querySelector<HTMLElement>("#yes-grading");
        yesButtonGrading.addEventListener("click", function () {
            document.querySelector("#items-panel").classList.remove("hidden");
            gradeChoicePanel.hide();
            scorePanel.show();
            document.querySelector<HTMLElement>("#choice-panel-grading .answer").innerText = yesButtonGrading.dataset["answer"];
        });

        document.querySelector("#no-grading").addEventListener("click", function () {
            window.location.href = evaluationUrl;
        });
    }


    function toUsersStep(): void {
        interceptAddMultiUserClicks();
        initCheckboxes();
        document.querySelector("#deadline-group .btn").classList.add("disabled");
        evalPanelElement.querySelector(".stepper-actions").remove();
        evalPanel.hide();
        userPanel.show();
        document.querySelector("#users-panel a[role=\"button\"]").setAttribute("href", "#users-step");
        document.querySelector("#users-panel a[role=\"button\"]").classList.remove("disabled");
        document.querySelector("#choice-panel-anonymize a[role=\"button\"]").setAttribute("href", "#choice-step-anonymize");
        document.querySelector("#choice-panel-anonymize a[role=\"button\"]").classList.remove("disabled");
        document.querySelector("#choice-panel-grading a[role=\"button\"]").setAttribute("href", "#choice-step-grading");
        document.querySelector("#choice-panel-grading a[role=\"button\"]").classList.remove("disabled");
        document.querySelector("#items-panel a[role=\"button\"]").setAttribute("href", "#items-step");
        document.querySelector("#items-panel a[role=\"button\"]").classList.remove("disabled");
    }

    function interceptAddMultiUserClicks(): void {
        let running = false;
        document.querySelectorAll(".user-select-option a").forEach(option => {
            option.addEventListener("click", async event => {
                if (!running) {
                    running = true;
                    event.preventDefault();
                    const button = option.querySelector(".btn");
                    const loader = option.parentNode.querySelector(".loader");
                    button.classList.add("hidden");
                    loader.classList.remove("hidden");
                    const response = await fetch(option.getAttribute("href"), { method: "POST" });
                    eval(await response.text());
                    loader.classList.add("hidden");
                    button.classList.remove("hidden");
                    running = false;
                }
            });
        });
    }

    init();
}
