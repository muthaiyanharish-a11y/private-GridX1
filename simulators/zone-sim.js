import axios from "axios";

const zoneId = "zone1";

function sendTelemetry() {
  const status = Math.random() > 0.8 ? "fault" : "ok"; // random fault
  axios.post("http://localhost:5000/telemetry", { zoneId, status })
    .then(() => console.log(`[${zoneId}] sent telemetry: ${status}`))
    .catch(err => console.error("Error sending telemetry:", err.message));
}

setInterval(sendTelemetry, 5000);
