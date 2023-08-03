import { customElement, property } from "lit/decorators.js";
import { html, TemplateResult } from "lit";
import { ShadowlessLitElement } from "components/meta/shadowless_lit_element";
import { isBetaCourse } from "saved_annotation_beta";
import { watchMixin } from "components/meta/watch_mixin";
import { createRef, Ref, ref } from "lit/directives/ref.js";
import "components/saved_annotations/saved_annotation_input";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { annotationState } from "state/Annotations";
import { userAnnotationState } from "state/UserAnnotations";

// Min and max of the annotation text is defined in the annotation model.
const maxLength = 10_000;

/**
 * This component represents a form for creating or editing saved annotations
 *
 * @element d-annotation-form
 *
 * @prop {String} annotationText - the text of the annotation
 * @prop {String} savedAnnotationId - the id of the saved annotation
 * @prop {Boolean} disabled - disables all buttons
 * @prop {Boolean} hasErrors - Shows red validation styling
 * @prop {String} submitButtonText - the I18n key of the text for the submit button
 *
 * @fires cancel - if a users uses the cancel button
 * @fires submit - if the users presses the submit button, detail contains {text: string, savedAnnotationId: string}
 */
@customElement("d-annotation-form")
export class AnnotationForm extends watchMixin(ShadowlessLitElement) {
    @property({ type: String, attribute: "annotation-text" })
    annotationText: string;
    @property({ type: String, attribute: "saved-annotation-id" })
    savedAnnotationId: string;
    @property({ type: Boolean })
    disabled = false;
    @property({ type: Boolean, attribute: "has-errors" })
    hasErrors = false;
    @property({ type: String, attribute: "submit-button-text" })
    submitButtonText: string;

    @property({ state: true })
    _annotationText = "";
    @property({ state: true })
    _savedAnnotationId = "";
    @property({ state: true })
    _savedAnnotationTitle: string;
    @property({ state: true })
    saveAnnotation = false;

    get savedAnnotationTitle(): string {
        return this._savedAnnotationTitle || this._annotationText.split(/\s+/).slice(0, 5).join(" ").slice(0, 40);
    }

    set savedAnnotationTitle(title: string) {
        this._savedAnnotationTitle = title;
    }

    inputRef: Ref<HTMLTextAreaElement> = createRef();
    titleRef: Ref<HTMLInputElement> = createRef();

    watch = {
        annotationText: () => {
            this._annotationText = this.annotationText;
        },
        savedAnnotationId: () => {
            this._savedAnnotationId = this.savedAnnotationId || "";
        }
    };

    get type(): string {
        return annotationState.isQuestionMode ? "user_question" : "user_annotation";
    }

    get rows(): number {
        return Math.max(3, this._annotationText.split("\n").length + 1);
    }


    /**
     * Event callback for when the user clicks anywhere on the page.
     * If the click is not on the annotation form or the annotation button, the annotation form is closed.
     * @param e The click event
     */
    static closeForm(e: MouseEvent): void {
        if (!(e.target as Element).closest("d-annotation-form") && !(e.target as Element).closest(".annotation-button")) {
            userAnnotationState.formShown = false;
            userAnnotationState.selectedRange = undefined;
        }
    }

    isListeningForClose = false;
    listenForClose(): void {
        if (!this.isListeningForClose) {
            document.addEventListener("click", AnnotationForm.closeForm);
            this.isListeningForClose = true;
        }
    }

    stopListeningForClose(): void {
        if (this.isListeningForClose) {
            document.removeEventListener("click", AnnotationForm.closeForm);
            this.isListeningForClose = false;
        }
    }

    connectedCallback(): void {
        super.connectedCallback();
        if (!this.annotationText) {
            this.listenForClose();
        }
    }

    disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopListeningForClose();
    }

    handleSavedAnnotationInput(e: CustomEvent): void {
        if (e.detail.text) {
            this._annotationText = e.detail.text;
        }
        this._savedAnnotationId = e.detail.id;
    }

    handleTextInput(): void {
        this._annotationText = this.inputRef.value.value;
        if (this._annotationText.length > 0) {
            this.stopListeningForClose();
        } else {
            this.listenForClose();
        }
    }

    handleCancel(): void {
        const event = new CustomEvent("cancel", { bubbles: true, composed: true });
        this.dispatchEvent(event);
    }

    handleSubmit(): void {
        if (!this.disabled) {
            this.hasErrors = false;
            this.disabled = true;

            if (!this.inputRef.value.reportValidity()) {
                this.hasErrors = true;
                this.disabled = false;
                return; // Something is wrong, abort.
            }

            const event = new CustomEvent("submit", {
                detail: {
                    text: this._annotationText,
                    savedAnnotationId: this._savedAnnotationId,
                    savedAnnotationTitle: this.savedAnnotationTitle,
                    saveAnnotation: this.saveAnnotation,
                },
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
        }
    }

    handleKeyDown(e: KeyboardEvent): boolean {
        if (e.code === "Enter" && e.shiftKey) {
            // Send using Shift-Enter.
            e.preventDefault();
            this.handleSubmit();
            return false;
        } else if (e.code === "Escape") {
            // Cancel using ESC.
            e.preventDefault();
            this.handleCancel();
            return false;
        }
    }

    handleUpdateTitle(): void {
        this.savedAnnotationTitle = this.titleRef.value.value;
    }

    firstUpdated(): void {
        this.inputRef.value.focus();
    }

    toggleSaveAnnotation(): void {
        this.saveAnnotation = !this.saveAnnotation;
    }

    render(): TemplateResult {
        console.log(this._savedAnnotationId);
        return html`
            <form class="annotation-submission form">
                <div class="row">
                    <div class="col-md-8">
                        <div class="field form-group">
                            <textarea id="annotation-text"
                                      autofocus
                                      required
                                      class="form-control annotation-submission-input ${this.hasErrors ? "validation-error" : ""}"
                                      .rows=${this.rows}
                                      minlength="1"
                                      maxlength="${maxLength}"
                                      .value=${this._annotationText}
                                      ${ref(this.inputRef)}
                                      @keydown="${e => this.handleKeyDown(e)}"
                                      @input="${() => this.handleTextInput()}"
                            ></textarea>
                            <div class="clearfix annotation-help-block">
                                <span class='help-block'>${unsafeHTML(I18n.t("js.user_annotation.help"))}</span>
                                ${annotationState.isQuestionMode ? html`
                                    <span class='help-block'>${unsafeHTML(I18n.t("js.user_annotation.help_student"))}</span>
                                ` : ""}
                                <span class="help-block float-end">
                                    <span class="used-characters">${I18n.formatNumber(this._annotationText.length)}</span> / ${I18n.formatNumber(maxLength)}
                                </span>
                            </div>
                        </div>
                    </div>
                    ${annotationState.isQuestionMode || /* REMOVE AFTER CLOSED BETA */ !isBetaCourse() ? "" : html`
                        <div class="col-md-4">
                            ${this.saveAnnotation ? html`
                                <label class="form-label" for="saved-annotation-title">
                                    ${I18n.t("js.saved_annotation.title")}
                                </label>
                                <input required="required"
                                       class="form-control"
                                       type="text"
                                       ${ref(this.titleRef)}
                                       @keydown="${e => this.handleKeyDown(e)}"
                                       @input=${() => this.handleUpdateTitle()}
                                       value=${this.savedAnnotationTitle}
                                       id="saved-annotation-title"
                                >
                            ` : html`
                                <d-saved-annotation-input
                                    name="saved_annotation_id"
                                    class="saved-annotation-input"
                                    .value=${this._savedAnnotationId}
                                    annotation-text="${this._annotationText}"
                                    @input="${e => this.handleSavedAnnotationInput(e)}"
                                ></d-saved-annotation-input>
                            `}
                        </div>
                    `}
                </div>
                <div class="row mb-1">
                    <div class="col-md-6 align-items-center d-inline-flex">
                        ${annotationState.isQuestionMode || /* REMOVE AFTER CLOSED BETA */ !isBetaCourse() ? "" : html`
                            <div class="field form-group" style="margin-bottom: 0">
                                <div class="form-check">
                                    <input class="form-check-input"
                                           type="checkbox"
                                           @click="${() => this.toggleSaveAnnotation()}"
                                           id="check-save-annotation"
                                           .checked=${this.saveAnnotation || this._savedAnnotationId != ""}
                                           .disabled=${this._savedAnnotationId != ""}
                                    >
                                    <label class="form-check-label" for="check-save-annotation" style="line-height: 20px">
                                        ${I18n.t("js.user_annotation.fields.saved_annotation_title")}
                                    </label>
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="col-md-6" style="text-align: right">
                        <button class="btn btn-text"
                                type="button"
                                @click="${() => this.handleCancel()}"
                                .disabled=${this.disabled}
                        >
                            ${I18n.t("js.user_annotation.cancel")}
                        </button>
                        <button class="btn btn-filled"
                                type="button"
                                @click="${() => this.handleSubmit()}"
                                .disabled=${this.disabled}
                        >
                            ${I18n.t(`js.${this.type}.${this.submitButtonText}`)}
                        </button>
                    </div>
                </div>
            </form>
        `;
    }
}
