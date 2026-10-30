// state.js
export const state = {
    allRecords: [],
    chartDonut: null,
    chartTrend: null,
    activePieceContext: null,
    isTableExpanded: false
};

export const getLocalDateString = (offsetDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const cleanRecords = (records) => {
    return records.map(r => {
        let corrected = { ...r };
        if (corrected.pieceType === 'COWL' && corrected.damage === 'Sin etiqueta') {
            corrected.damage = 'Contaminación';
        }
        corrected.quantity = parseInt(corrected.quantity) || 1;
        return corrected;
    });
};
