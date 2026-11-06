/* State global aplikasi */

// APP STATE
let monitoringList = [];

let overlineList = [];

let chartReadinessInstance = null;

let chartEngineerInstance = null;

let chartLineStatusInstance = null;

let activeRecordSubTab = 'monitoring';

// AUTH / SUPABASE STATE
let sb = null;

let currentSession = null;

let currentProfile = null;

let appStarted = false;

// RIWAYAT & TIMELINE
let chartTimelineInstance = null;

let chartStageInstance = null;

let historyRows = [];          // seluruh riwayat (untuk grafik timeline)

let historyAvailable = null;   // null = belum dimuat, true / false = tabel riwayat ada / belum ada

let historyError = '';
