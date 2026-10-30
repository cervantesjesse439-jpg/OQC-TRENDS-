// app.js
import { baseLineColors, lineColorsMap, legendColorsForLines, pieceColorConfig } from "./config.js";
import { state, getLocalDateString } from "./state.js";
import { initFirebase } from "./firebase.js";
import { initCharts } from "./charts.js";
import { renderTable, toggleTableFullscreen, downloadCSV } from "./table.js";

// Reloj en tiempo real
setInterval(() => {
    const timeEl = document.getElementById('header-time');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('es-MX', { hour12: false });
}, 1000);

export function setDateRange(type) {
    document.getElementById('date-end').value = getLocalDateString(0); 
    if (type === 'today') document.getElementById('date-start').value = getLocalDateString(0);
    else if (type === '7days') document.getElementById('date-start').value = getLocalDateString(-6);
    else if (type === '30days') document.getElementById('date-start').value = getLocalDateString(-29);
    
    if (state.allRecords.length > 0) processDataAndRender();
}

export function handleDropdownFilter() {
    const val = document.getElementById('filter-line').value;
    if (val === 'ALL') {
        clearInteractiveSelection();
    } else {
        state.activePieceContext = val;
        document.getElementById('lbl-active-filter').textContent = `${val}`;
        document.getElementById('btn-clear-filter').classList.remove('hidden');
        processDataAndRender();
    }
}

export function clearInteractiveSelection() {
    state.activePieceContext = null;
    const btnClear = document.getElementById('btn-clear-filter');
    if (btnClear) btnClear.classList.add('hidden');
    const filterLine = document.getElementById('filter-line');
    if (filterLine) filterLine.value = 'ALL'; 
    
    if (state.chartDonut) {
        state.chartDonut.updateOptions({ colors: baseLineColors });
        setTimeout(() => {
            const paths = document.querySelectorAll('.apexcharts-pie-series path');
            paths.forEach(p => {
                p.removeAttribute('selected');
                p.removeAttribute('data:selected');
            });
        }, 10);
    }
    processDataAndRender();
}

export function processDataAndRender() {
    const startStr = document.getElementById('date-start').value;
    const endStr = document.getElementById('date-end').value;

    if (!startStr || !endStr) return;
    if (startStr > endStr) { 
        document.getElementById('date-start').value = endStr; 
        return processDataAndRender(); 
    }

    const rangeLbl = document.getElementById('lbl-trend-range');
    if (rangeLbl) rangeLbl.textContent = `${startStr.substring(5)} al ${endStr.substring(5)}`;

    let baseRecords = state.allRecords.filter(r => r.dateString >= startStr && r.dateString <= endStr);
    
    let activeTableRecords = baseRecords;
    if (state.activePieceContext) {
        activeTableRecords = activeTableRecords.filter(r => (r.pieceType || 'UPR') === state.activePieceContext);
    }

    let stats = { totalRechazos: 0, upr: 0, cowl: 0, pocket: 0, cover: 0 };
    let defectCounts = {};

    baseRecords.forEach(r => {
        let qty = r.quantity || 1; 
        let pt = r.pieceType || 'UPR';
        let isDefect = r.damage !== 'Tarimas OK';
        
        if (isDefect) {
            if (pt === 'UPR') stats.upr += qty; 
            else if (pt === 'COWL') stats.cowl += qty; 
            else if (pt === 'POCKET') stats.pocket += qty; 
            else if (pt === 'COVER') stats.cover += qty;
            
            if (state.activePieceContext && pt === state.activePieceContext) {
                if (!defectCounts[r.damage]) defectCounts[r.damage] = { name: r.damage, qty: 0 };
                defectCounts[r.damage].qty += qty;
            } 
            else if (!state.activePieceContext) {
                let key = `${r.damage} [${pt}]`;
                if (!defectCounts[key]) defectCounts[key] = { name: key, qty: 0, line: pt };
                defectCounts[key].qty += qty;
            }
        }
    });

    stats.totalRechazos = state.activePieceContext ? stats[state.activePieceContext.toLowerCase()] : (stats.upr + stats.cowl + stats.pocket + stats.cover);
    
    const kpiTotal = document.getElementById('kpi-total');
    if (kpiTotal) kpiTotal.textContent = stats.totalRechazos;
    const kpiRegs = document.getElementById('kpi-registros');
    if (kpiRegs) kpiRegs.textContent = activeTableRecords.length;
    
    const opacityLogic = (targetLine) => (!state.activePieceContext || state.activePieceContext === targetLine) ? '1' : '0.2';
    const panelUpr = document.getElementById('kpi-panel-upr');
    if (panelUpr) { panelUpr.style.opacity = opacityLogic('UPR'); document.getElementById('kpi-upr').textContent = stats.upr; }
    const panelCowl = document.getElementById('kpi-panel-cowl');
    if (panelCowl) { panelCowl.style.opacity = opacityLogic('COWL'); document.getElementById('kpi-cowl').textContent = stats.cowl; }
    const panelPc = document.getElementById('kpi-panel-pc');
    if (panelPc) {
        panelPc.style.opacity = (!state.activePieceContext || state.activePieceContext === 'POCKET' || state.activePieceContext === 'COVER') ? '1' : '0.2';
        document.getElementById('kpi-pocket').textContent = stats.pocket; 
        document.getElementById('kpi-cover').textContent = stats.cover;
    }

    if (state.chartDonut) {
        state.chartDonut.updateSeries([stats.upr, stats.cowl, stats.pocket, stats.cover]);
        
        if (state.activePieceContext) {
            const idx = ['UPR', 'COWL', 'POCKET', 'COVER'].indexOf(state.activePieceContext);
            const focusedColors = baseLineColors.map((color, index) => index === idx ? color : '#2d313a');
            state.chartDonut.updateOptions({ colors: focusedColors });
        } else {
            state.chartDonut.updateOptions({ colors: baseLineColors });
        }
    }

    const centerEl = document.getElementById('donut-center');
    let trendLinesData = []; 

    if (centerEl) {
        if (!state.activePieceContext) {
            centerEl.style.boxShadow = 'inset 0 0 15px rgba(0,0,0,0.8)';
            centerEl.style.borderColor = '#4b5563';
            
            centerEl.innerHTML = `
                <i class="fas fa-hand-pointer text-blue-400 text-3xl md:text-4xl mb-1.5 pulse-icon drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]"></i>
                <span class="text-[9px] md:text-[10px] font-bold text-gray-300 uppercase tracking-widest leading-tight text-center px-1">Click para<br>Analizar</span>
            `;

            if (state.chartTrend) {
                let trendLabels = [];
                let currDate = new Date(startStr + 'T12:00:00'); 
                let endDateObj = new Date(endStr + 'T12:00:00');
                if (Math.ceil((endDateObj - currDate) / (1000 * 60 * 60 * 24)) > 60) { 
                    currDate = new Date(endDateObj); 
                    currDate.setDate(currDate.getDate() - 60); 
                }

                let baseSeries = [
                    {name:'UPR', type:'column', data:[], color:'#3b82f6'}, 
                    {name:'COWL', type:'column', data:[], color:'#6366f1'}, 
                    {name:'POCKET', type:'column', data:[], color:'#14b8a6'}, 
                    {name:'COVER', type:'column', data:[], color:'#10b981'}
                ];
                
                while (currDate <= endDateObj) {
                    const dStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`;
                    trendLabels.push(dStr.substring(5));
                    const dayRecords = baseRecords.filter(r => r.dateString === dStr && r.damage !== 'Tarimas OK');
                    
                    let daily = {UPR:0, COWL:0, POCKET:0, COVER:0};
                    dayRecords.forEach(r => daily[r.pieceType || 'UPR'] += (r.quantity || 1));
                    baseSeries.forEach(s => s.data.push(daily[s.name]));
                    currDate.setDate(currDate.getDate() + 1);
                }

                state.chartTrend.updateOptions({ chart: { stacked: true }, xaxis: { categories: trendLabels }, stroke: { width: [0,0,0,0] } });
                state.chartTrend.updateSeries(baseSeries);
            }

        } else {
            const activeColor = lineColorsMap[state.activePieceContext];
            centerEl.style.boxShadow = `0 0 25px ${activeColor}80, inset 0 0 15px rgba(0,0,0,0.9)`;
            centerEl.style.borderColor = activeColor;

            let defArray = Object.values(defectCounts).sort((a, b) => b.qty - a.qty);
            let topDamages = defArray.slice(0, 4);
            let pClass = pieceColorConfig[state.activePieceContext] || 'text-white';

            let centerHtml = `<span class="text-[12px] font-black px-4 py-0.5 rounded-full ${pClass} mb-1.5 shadow-sm tracking-widest border border-current">${state.activePieceContext}</span>`;
            centerHtml += `<div class="flex flex-col gap-1 w-full px-3 mt-0.5">`;
            
            if (topDamages.length === 0) {
                centerHtml += `<span class="text-[9px] text-gray-500 font-bold text-center">Cero registros</span>`;
            } else {
                topDamages.forEach((d, i) => {
                    let color = legendColorsForLines[i % legendColorsForLines.length];
                    trendLinesData.push({ name: d.name, color: color }); 
                    centerHtml += `
                        <div class="flex items-center gap-1.5 w-full bg-[#12141a]/60 rounded-md px-1.5 py-0.5 border border-white/5">
                            <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${color}; box-shadow: 0 0 6px ${color}"></div>
                            <span class="text-[9px] text-gray-200 truncate font-bold text-left flex-1" title="${d.name}">${d.name}</span>
                        </div>
                    `;
                });
            }
            centerHtml += `</div>`;
            centerEl.innerHTML = centerHtml;

            if (state.chartTrend) {
                let trendLabels = [];
                let currDate = new Date(startStr + 'T12:00:00'); 
                let endDateObj = new Date(endStr + 'T12:00:00');
                if (Math.ceil((endDateObj - currDate) / (1000 * 60 * 60 * 24)) > 60) { 
                    currDate = new Date(endDateObj); 
                    currDate.setDate(currDate.getDate() - 60); 
                }

                let barSeries = { name: `Volumen ${state.activePieceContext}`, type: 'column', data: [], color: activeColor };
                let lineSeries = trendLinesData.map(tData => ({ name: tData.name, type: 'line', data: [], color: tData.color }));

                while (currDate <= endDateObj) {
                    const dStr = `${currDate.getFullYear()}-${String(currDate.getMonth() + 1).padStart(2, '0')}-${String(currDate.getDate()).padStart(2, '0')}`;
                    trendLabels.push(dStr.substring(5));
                    
                    const dayRecords = baseRecords.filter(r => r.dateString === dStr && r.damage !== 'Tarimas OK' && (r.pieceType || 'UPR') === state.activePieceContext);
                    
                    let totalPieceQty = 0;
                    let dmgQtys = {}; 
                    trendLinesData.forEach(t => dmgQtys[t.name] = 0);
                    
                    dayRecords.forEach(r => {
                        let q = r.quantity || 1;
                        totalPieceQty += q;
                        if (dmgQtys[r.damage] !== undefined) dmgQtys[r.damage] += q;
                    });
                    
                    barSeries.data.push(totalPieceQty);
                    lineSeries.forEach(ls => { ls.data.push(dmgQtys[ls.name]); });
                    
                    currDate.setDate(currDate.getDate() + 1);
                }
                
                let finalSeries = [barSeries, ...lineSeries];
                let strokeWidths = [0]; 
                lineSeries.forEach(() => strokeWidths.push(1.5)); 
                
                state.chartTrend.updateOptions({ 
                    chart: { stacked: false }, 
                    xaxis: { categories: trendLabels }, 
                    stroke: { width: strokeWidths, curve: 'smooth' },
                    fill: { opacity: [0.15, 1, 1, 1, 1, 1] }
                });
                state.chartTrend.updateSeries(finalSeries);
            }
        }
    }

    const topContainer = document.getElementById('top-defects-container');
    if (topContainer) {
        let defArrayUI = Object.values(defectCounts).sort((a, b) => b.qty - a.qty);
        let sortedDefectsUI = defArrayUI.slice(0, 6); 
        
        if (sortedDefectsUI.length === 0) {
            topContainer.innerHTML = '<div class="text-center text-gray-500 font-bold text-xs mt-10 uppercase tracking-widest"><i class="fas fa-check-circle text-3xl mb-2 text-gray-700 block"></i> Cero Defectos</div>';
        } else {
            let maxQty = sortedDefectsUI[0].qty;
            topContainer.innerHTML = sortedDefectsUI.map((def) => {
                let pct = (def.qty / maxQty) * 100;
                let lColor = state.activePieceContext ? lineColorsMap[state.activePieceContext] : (lineColorsMap[def.line] || '#3498db');
                return `
                <div class="flex items-center text-[10px] md:text-xs">
                    <div class="w-[120px] md:w-[140px] truncate text-gray-300 font-bold uppercase pr-2" title="${def.name}">${def.name}</div>
                    <div class="flex-1 bg-[#12141a] h-4 rounded overflow-hidden border border-gray-800 relative">
                        <div class="h-full rounded shadow-inner" style="width: ${pct}%; background-color: ${lColor}"></div>
                    </div>
                    <div class="w-[30px] text-right font-condensed font-bold text-white text-sm">${def.qty}</div>
                </div>`;
            }).join('');
        }
    }

    renderTable(activeTableRecords);
}

export function toggleFullscreen() { 
    if (!document.fullscreenElement) document.documentElement.requestFullscreen(); 
    else document.exitFullscreen(); 
}

// Eventos y bindings globales en window para atributos onclick/onchange del HTML
window.setDateRange = setDateRange;
window.handleDropdownFilter = handleDropdownFilter;
window.clearInteractiveSelection = clearInteractiveSelection;
window.processDataAndRender = processDataAndRender;
window.toggleTableFullscreen = toggleTableFullscreen;
window.downloadCSV = downloadCSV;
window.toggleFullscreen = toggleFullscreen;

document.addEventListener('fullscreenchange', () => { 
    const btnFs = document.getElementById('btn-fullscreen');
    if (btnFs) {
        btnFs.innerHTML = !document.fullscreenElement 
            ? '<i class="fas fa-expand text-gray-400"></i>' 
            : '<i class="fas fa-compress text-blue-400"></i>'; 
    }
});

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date-start').value = getLocalDateString(0);
    document.getElementById('date-end').value = getLocalDateString(0);
    
    initCharts((selectedLabel) => {
        if (state.activePieceContext === selectedLabel) {
            clearInteractiveSelection();
        } else {
            state.activePieceContext = selectedLabel;
            const filterEl = document.getElementById('filter-line');
            if (filterEl) filterEl.value = selectedLabel;
            const lblEl = document.getElementById('lbl-active-filter');
            if (lblEl) lblEl.textContent = `${selectedLabel}`;
            const btnEl = document.getElementById('btn-clear-filter');
            if (btnEl) btnEl.classList.remove('hidden');
            processDataAndRender();
        }
    });

    initFirebase(() => {
        processDataAndRender();
    });
});
