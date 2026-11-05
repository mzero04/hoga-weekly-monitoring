/* Konstanta master (engineer, line, status) dan data sampel */

// MASTER CONSTANTS & OPTIONS
const MASTER_ENGINEERS = [
    "Viona Iswi Nurlestari",
    "Aulia Darma Putra",
    "Diva Nuratnika Rahayu",
    "Jaka Muhammad Zaelani",
    "Garnis Kirani",
    "Hamidah Nur Wahdaniah",
    "Mita Monika",
    "Shalma Amelia",
    "Rifqi Ikhsan",
    "Rizma Nurhasna Fauziyah",
    "Virgiawan Ramadhan"
];

const MASTER_LINES = Array.from({ length: 31 }, (_, i) => `B${i + 1}`);

const MASTER_STATUS = ["Done", "In Progress", "Pending", "Not Started", "N/A"];

// SAMPLE DATA PRESETS (dipakai oleh tombol "Reset Demo" khusus admin)
const INITIAL_MONITORING_DATA = [
    {
        reportDate: "2026-11-01",
        engineer: "Viona Iswi Nurlestari",
        line: "B1",
        currentStyle: "ST-BASIC-01",
        nextStyle: "ST-JACKET-99",
        plannedStartDate: "2026-11-10",
        preLayoutStatus: "Done",
        ppApprovalStatus: "Done",
        chiefSampleStatus: "Done",
        remark: "All preparation ready for style change."
    },
    {
        reportDate: "2026-11-02",
        engineer: "Aulia Darma Putra",
        line: "B5",
        currentStyle: "ST-SHIRT-11",
        nextStyle: "ST-POLO-44",
        plannedStartDate: "2026-11-08",
        preLayoutStatus: "In Progress",
        ppApprovalStatus: "Pending",
        chiefSampleStatus: "Not Started",
        remark: "Waiting PP Sample Approval from Buyer."
    },
    {
        reportDate: "2026-11-03",
        engineer: "Diva Nuratnika Rahayu",
        line: "B12",
        currentStyle: "ST-PANTS-88",
        nextStyle: "ST-DENIM-02",
        plannedStartDate: "2026-11-15",
        preLayoutStatus: "Done",
        ppApprovalStatus: "In Progress",
        chiefSampleStatus: "Done",
        remark: "Layout approved, chief sample complete."
    },
    {
        reportDate: "2026-11-04",
        engineer: "Jaka Muhammad Zaelani",
        line: "B20",
        currentStyle: "ST-VEST-03",
        nextStyle: "ST-COAT-77",
        plannedStartDate: "2026-11-05",
        preLayoutStatus: "Not Started",
        ppApprovalStatus: "Pending",
        chiefSampleStatus: "Pending",
        remark: "Critical delay in PP sample approval."
    }
];

const INITIAL_OVERLINE_DATA = [
    {
        reportWeekStart: "2026-11-01",
        engineer: "Aulia Darma Putra",
        line: "B5",
        currentStyle: "ST-SHIRT-11",
        nextStyle: "ST-POLO-44",
        plannedOverlineDate: "2026-11-09",
        status: "Pending",
        remark: "Machine breakdown on main assembly."
    },
    {
        reportWeekStart: "2026-11-01",
        engineer: "Garnis Kirani",
        line: "B18",
        currentStyle: "ST-KIDS-01",
        nextStyle: "ST-KIDS-02",
        plannedOverlineDate: "2026-11-03",
        status: "Done",
        remark: "Resolved with extra technical support."
    }
];
