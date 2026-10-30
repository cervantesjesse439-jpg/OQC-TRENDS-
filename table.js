// table.js
import { state } from "./state.js";

export function renderTable(records) {
    const tbody = document.getElementById('table-body');
    const emptyState = document.getElementById('table-empty-state');
    const recordCountEl = document.getElementById('table-record-count');
    if (recordCountEl) recordCountEl.textContent = `${records.length} EVENTOS`;

    if (records.length === 0) { 
        if (tbody) tbody.innerHTML = ''; 
        if (emptyState) emptyState.classList.remove('hidden'); 
        return; 
    }
    if (emptyState) emptyState.classList.add('hidden');
    
    const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp);

    if (tbody) {
        tbody.innerHTML = sortedRecords.map(r => {
            const dObj = new Date(r.timestamp);
            const timeStr = `${dObj.toLocaleDateString('es-MX', {day:'2-digit', month:'2-digit'})} <span class="text-gray-600 mx-1">|</span> ${dObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
            const isPalletsOK = r.damage === 'Tarimas OK'; 
            const pt = r.pieceType || 'UPR';
            
            let badgeColor = pt === 'COWL' 
                ? 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50' 
                : (pt === 'POCKET' 
                    ? 'bg-teal-900/30 text-teal-400 border-teal-800/50' 
                    : (pt === 'COVER' 
                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' 
                        : 'bg-blue-900/30 text-blue-400 border-blue-800/50'));
            
            let damageBadge = isPalletsOK 
                ? `<span class="bg-green-900/30 text-green-400 border border-green-800/50 px-2.5 py-1 rounded text-[10px] font-bold shadow-sm whitespace-nowrap"><i class="fas fa-check-double mr-1"></i>${r.damage}</span>` 
                : `<span class="bg-red-900/20 text-red-400 border border-red-900/50 px-2.5 py-1 rounded text-[10px] font-bold shadow-sm whitespace-nowrap">${r.damage}</span>`;
            
            let qtyStr = isPalletsOK ? `<span class="text-emerald-500 font-bold">${r.pallets} (TR)</span>` : r.quantity;
            let variantSide = (r.side && r.side !== 'N/A') ? r.side : '';
            if (r.variant && r.variant !== 'N/A') variantSide += (variantSide ? ' / ' : '') + r.variant;
            if (r.cartDefectPieces > 0) variantSide += (variantSide ? ' <span class="text-blue-400">(~' + r.cartDefectPieces + '/50 pzs)</span>' : '~' + r.cartDefectPieces + '/50 pzs');

            return `<tr>
                <td class="font-condensed text-gray-400 text-[11px]">${timeStr}</td>
                <td class="font-bold"><span class="${badgeColor} border px-2 py-0.5 rounded text-[9px] tracking-widest uppercase shadow-sm">${pt}</span></td>
                <td class="text-gray-400 uppercase text-[9px] tracking-wider font-bold">${r.type || 'PIEZA'}</td>
                <td class="text-gray-300 text-xs font-bold">${variantSide || '-'}</td>
                <td>${damageBadge}</td>
                <td class="text-center font-condensed text-white text-sm font-bold bg-[#1a1c23]/50 border-x border-[#2d313a]">${qtyStr}</td>
                <td class="text-gray-500 text-[10px] uppercase font-bold truncate max-w-[120px]"><i class="fas fa-user-tag text-gray-700 mr-1"></i> ${r.inspectorName || 'ANÓNIMO'}</td>
            </tr>`;
        }).join('');
    }
}

export function toggleTableFullscreen() {
    state.isTableExpanded = !state.isTableExpanded;
    const wrapper = document.getElementById('table-card-wrapper');
    const icon = document.getElementById('expand-icon');
    const text = document.getElementById('expand-text');
    const scrollArea = document.getElementById('table-scroll-area');

    if (!wrapper) return;

    if (state.isTableExpanded) {
        wrapper.classList.add('table-fullscreen');
        if (icon) icon.className = 'fas fa-compress-alt';
        if (text) text.textContent = 'Minimizar';
        if (scrollArea) scrollArea.style.maxHeight = 'none';
    } else {
        wrapper.classList.remove('table-fullscreen');
        if (icon) icon.className = 'fas fa-expand-alt';
        if (text) text.textContent = 'Expandir';
    }
}

export function downloadCSV() {
    if (state.allRecords.length === 0) return alert("No hay datos para exportar.");
    const startStr = document.getElementById('date-start').value; 
    const endStr = document.getElementById('date-end').value;
    
    let exportData = state.allRecords.filter(r => r.dateString >= startStr && r.dateString <= endStr);
    if (state.activePieceContext) {
        exportData = exportData.filter(r => (r.pieceType || 'UPR') === state.activePieceContext);
    }
    
    const headers = ['FECHA', 'HORA', 'LINEA', 'DEFECTO', 'CANTIDAD', 'TARIMAS', 'INSPECTOR'];
    const rows = exportData.sort((a, b) => b.timestamp - a.timestamp).map(r => {
        const d = new Date(r.timestamp);
        return [
            d.toLocaleDateString('es-MX'), 
            d.toLocaleTimeString('es-MX'), 
            r.pieceType || 'UPR', 
            r.damage, 
            r.damage === 'Tarimas OK' ? 0 : r.quantity, 
            r.pallets || 0, 
            r.inspectorName || 'Anónimo'
        ].map(v => `"${v}"`).join(',');
    });

    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(new Blob(["\ufeff", [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })));
    link.setAttribute("download", `Export_${state.activePieceContext || 'GLOBAL'}_${startStr}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
}
