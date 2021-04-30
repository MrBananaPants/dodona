import * as d3 from "d3";
import { formatTitle } from "graph_helper.js";

let selector = "#stacked_status-container";
const margin = { top: 20, right: 150, bottom: 60, left: 105 };
let width = 0;
let height = 0;
const statusOrder = [
    "correct", "wrong", "compilation error", "runtime error",
    "time limit exceeded", "memory limit exceeded", "output limit exceeded",
];

function drawStacked(data: {
    "cum_sum": number;
    "count": number;
    "exercise_id": string;
    "status": string;
}[], maxSum, exMap): void {
    const yDomain: string[] = exMap.map(ex => ex[0]).reverse();
    // height = 100 * yDomain.length;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const yAxisPadding = 5; // padding between y axis (labels) and the actual graph

    const container = d3.select(selector);


    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);
    const graph = svg
        .append("g")
        .attr("transform",
            "translate(" + margin.left + "," + margin.top + ")");

    // Show the Y scale
    const y = d3.scaleBand()
        .range([innerHeight, 0])
        .domain(yDomain)
        .padding(.5);

    const yAxis = graph.append("g")
        .call(d3.axisLeft(y).tickSize(0))
        .attr("transform", `translate(-${yAxisPadding}, 0)`);
    yAxis
        .select(".domain").remove();
    yAxis
        .selectAll(".tick text")
        .call(formatTitle, margin.left-yAxisPadding, exMap);


    // Show the X scale
    const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, innerWidth]);


    // Color scale
    const color = d3.scaleOrdinal()
        .range(d3.schemeDark2)
        .domain(statusOrder);

    const tooltip = d3.select(selector).append("div")
        .attr("class", "d3-tooltip")
        .attr("pointer-events", "none")
        .style("opacity", 0)
        .style("z-index", 5);

    const legend = graph.append("g")
        .attr("transform", `translate(${-margin.left/2}, ${innerHeight + 40})`);

    let legendX = 0;
    for (const status of statusOrder) {
        // add legend colors dots
        const group = legend.append("g");

        group
            .append("rect")
            .attr("x", legendX)
            .attr("y", 0)
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", color(status) as string);

        // add legend text
        group
            .append("text")
            .attr("x", legendX + 20)
            .attr("y", 12)
            .attr("text-anchor", "start")
            .text(status)
            .attr("fill", "currentColor")
            .style("font-size", "12px");

        legendX += group.node().getBBox().width + 20;
    }

    // add bars
    graph.selectAll("bars")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x((d.cum_sum - d.count) / maxSum[d.exercise_id]))
        .attr("width", d => x(d.count / maxSum[d.exercise_id]))
        .attr("y", d => y(d.exercise_id))
        .attr("height", y.bandwidth())
        .attr("fill", d => color(d.status) as string)
        .on("mouseover", (e, d) => {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`${d.count}/${maxSum[d.exercise_id]} (${
                Math.round((d.count) / maxSum[d.exercise_id] * 10000) / 100
            }%) ${d.status}`);
        })
        .on("mousemove", (e, _) => {
            tooltip
                .style("left", `${d3.pointer(e, svg.node())[0]-tooltip.node().clientWidth*1.1}px`)
                .style("top", `${d3.pointer(e, svg.node())[1]-tooltip.node().clientHeight*1.25}px`);
        })
        .on("mouseout", () => {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });


    const gridlines = graph.append("g")
        .call(d3.axisBottom(x).tickValues([.2, .4, .6, .8]).tickFormat((t: number) => `${t*100}%`)
            .tickSize(innerHeight).tickSizeOuter(0));
    gridlines
        .select(".domain").remove();
    gridlines.selectAll("line").style("stroke-dasharray", ("3, 3"));

    for (const ex of data) {
        const t = maxSum[ex.exercise_id];
        graph.append("text")
            .attr("x", innerWidth + 10)
            .attr("y", y(ex.exercise_id) + y.bandwidth()/2)
            .text(
                `${I18n.t("js.total")}: ${t} ${I18n.t(t===1 ?
                    "js.submission" : "js.submissions")}`
            )
            .attr("fill", "currentColor")
            .style("font-size", "12px");
    }
}

function initStacked(url, containerId: string, containerHeight: number): void {
    height = containerHeight;
    selector = containerId;
    const container = d3.select(selector);

    if (!height) {
        height = container.node()["clientHeight"] - 5;
    }
    container
        .html("") // clean up possible previous visualisations
        .style("height", `${height}px`)
        .style("display", "flex")
        .style("align-items", "center")
        .attr("class", "text-center")
        .append("div")
        .text(I18n.t("js.loading"))
        .style("margin", "auto");

    width = (container.node() as Element).getBoundingClientRect().width;
    const processor = function (raw): void {
        if (raw["status"] == "not available yet") {
            setTimeout(() => d3.json(url).then(processor), 1000);
            return;
        }
        d3.select(`${selector} *`).remove();

        const data = raw.data;

        if (data.length === 0) {
            container
                .style("height", "50px")
                .append("div")
                .text(I18n.t("js.no_data"))
                .style("margin", "auto");
            return;
        }

        height = 75 * Object.keys(raw.data).length;
        container
            .style("height", `${height}px`);

        data.sort((a, b) => {
            if (a.exercise_id === b.exercise_id) {
                return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
            } else {
                return a.exercise_id - b.exercise_id;
            }
        });
        let prevId = data[0].exercise_id;
        let prevSum = 0;
        const maxSum = {};
        data.forEach(d => {
            if (prevId !== d.exercise_id) {
                maxSum[prevId] = prevSum;
                prevId = d.exercise_id;
                prevSum = 0;
            }
            prevSum += d.count;
            d["cum_sum"] = prevSum;
        });
        maxSum[prevId] = prevSum;

        drawStacked(data, maxSum, raw.exercises);
    };
    d3.json(url).then(processor);
}

export { initStacked };
