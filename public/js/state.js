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
