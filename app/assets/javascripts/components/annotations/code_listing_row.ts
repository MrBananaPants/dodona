import { ShadowlessLitElement } from "components/meta/shadowless_lit_element";
import { property } from "lit/decorators.js";
import { html, TemplateResult } from "lit";
import { stateMixin } from "state/StateMixin";
import { getMachineAnnotationsByLine, MachineAnnotationData } from "state/MachineAnnotations";
import { getUserAnnotationsByLine, UserAnnotationData } from "state/UserAnnotations";

export class CodeListingRow extends stateMixin(ShadowlessLitElement) {
    @property({ type: Number })
    row: number;
    @property({ type: Object })
    renderedCode: HTMLElement;

    state = ["getUserAnnotations", "getMachineAnnotations"];

    get machineAnnotations(): MachineAnnotationData[] {
        return getMachineAnnotationsByLine(this.row);
    }

    get userAnnotations(): UserAnnotationData[] {
        return getUserAnnotationsByLine(this.row);
    }

    getMachineAnnotationsOfType(type: string): TemplateResult[] {
        return this.machineAnnotations.filter(a => a.type === type).map(a => html`
            <d-machine-annotation .data=${a}></d-machine-annotation>
        `);
    }

    render(): TemplateResult {
        return html`
            <tr id="line-${this.row}" class="lineno">
                <td class="rouge-gutter gl">
                    <button class="btn btn-icon btn-icon-filled bg-primary annotation-button" title="Toevoegen">
                    <pre>${this.row}</pre>
                </td>
                <td class="rouge-code">
                    <pre>${this.renderedCode}</pre>
                    <div class="annotation-cell" id="annotation-cell-1">
                        <div class="annotation-group-error">
                            ${this.getMachineAnnotationsOfType("error")}
                        </div>
                        <div class="annotation-group-conversation">
                            ${this.userAnnotations.map(a => html`
                                <d-user-annotation .data=${a}></d-user-annotation>
                            `)}
                        </div>
                        <div class="annotation-group-warning">
                            ${this.getMachineAnnotationsOfType("warning")}
                        </div>
                        <div class="annotation-group-info">
                            ${this.getMachineAnnotationsOfType("info")}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }
}
