import "components/datalist_input";
import { DatalistInput } from "components/datalist_input";
import { fixture, nextFrame, oneEvent } from "@open-wc/testing-helpers";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/dom";


describe("DatalistInput", () => {
    it("has an input field", async () => {
        const datalistInput = await fixture(`<d-datalist-input></d-datalist-input>`);
        expect(datalistInput.querySelector("input:not([type=hidden])")).toBeDefined();
    });

    it("has a property placeholder which defines the placeholder for the input field", async () => {
        const datalistInput = await fixture(`<d-datalist-input placeholder="foo"></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        expect(input?.placeholder).toBe("foo");
        datalistInput.setAttribute("placeholder", "bar");
        await nextFrame();

        expect(input?.placeholder).toBe("bar");
    });

    it("has a property value which sets the value for the hidden named input field", async () => {
        const datalistInput = await fixture(`<d-datalist-input name="foo" value="bar"></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input[type=hidden]") as HTMLInputElement;
        expect(input?.value).toBe("bar");
        expect(input?.name).toBe("foo");

        datalistInput.setAttribute("value", "bars");
        await nextFrame();
        expect(input?.value).toBe("bars");
    });

    it("sets the value of the shown input field to the label of the option with the value of the hidden input field", async () => {
        const datalistInput = await fixture(`<d-datalist-input value="bar" options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        expect(input?.value).toBe("foo");
    });

    it("updates the value of the hidden input field when the shown input field is changed", async () => {
        const datalistInput = await fixture(`<d-datalist-input value="bar" options='[{"label": "foo", "value": "bar"},{"label": "foo2", "value": "bar2"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "2");
        expect(datalistInput.value).toBe("bar2");
    });

    it("Supports tab completion", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "f");
        expect(input.value).toBe("f");
        await userEvent.type(input, "{tab}");
        expect(input.value).toBe("foo");
    });

    it("fires an input event when the value changes", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;

        userEvent.type(input, "fool");
        let e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "f", value: "" });
        e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "fo", value: "" });
        e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "foo", value: "bar" });
        e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "fool", value: "" });
    });

    it("fires an input event when the value changes with tab completion", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;

        userEvent.type(input, "f");
        let e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "f", value: "" });
        userEvent.type(input, "{tab}");
        e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "foo", value: "bar" });
    });

    it("updates the input field when options are updated", async () => {
        const datalistInput = await fixture(`<d-datalist-input value="bar2" options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        expect(input.value).toBe("");
        datalistInput.options = [{ label: "foo", value: "bar" }, { label: "foo2", value: "bar2" }];
        await nextFrame();
        expect(input.value).toBe("foo2");
    });

    it("fires an input event if new options result in a change", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "foo2");
        datalistInput.options = [{ label: "foo", value: "bar" }, { label: "foo2", value: "bar2" }];
        const e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "foo2", value: "bar2" });
    });

    it("thows a list of options when the input field is focused", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "f");
        expect(screen.getByText("foo")).toBeDefined();
    });

    it("autocompletes and fires an event when an option is selected", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "f");
        const option = screen.getByText("foo");
        userEvent.click(option);
        const e = await oneEvent(datalistInput, "input");
        expect(e.detail).toEqual({ label: "foo", value: "bar" });
        expect(input.value).toBe("foo");
    });

    it("does not show unmatched options", async () => {
        const datalistInput = await fixture(`<d-datalist-input options='[{"label": "foo", "value": "bar"}]'></d-datalist-input>`) as DatalistInput;
        const input = datalistInput.querySelector("input:not([type=hidden])") as HTMLInputElement;
        await userEvent.type(input, "fool");
        expect(screen.queryByText("foo")).toBeNull();
    });
});
