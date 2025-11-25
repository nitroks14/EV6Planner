const BATTERY_KWH = 84;
const RESERVE_MIN = 10;
const LUNCH_RADIUS_KM = 0.3;

document.getElementById('planner-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const socStart = parseFloat(document.getElementById('socStart').value);
  const socMin = parseFloat(document.getElementById('socMin').value);
  const horizon = document.getElementById('horizon').value;

  const events = await mockAgenda(horizon);
  const plan = calculatePlan(events, socStart, socMin);

  displayResult(plan);

  const aiAdvice = await callAI({ events, socStart, socMin, stations: ['Ionity Caen', 'AC Municipale Lisieux'] });
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML += `<h3>Conseil IA :</h3><p>${aiAdvice}</p>`;
});

function mockAgenda(horizon) {
  return Promise.resolve([
    { type: 'rdv', title: 'Client A', location: 'Caen', start: '08:00', end: '10:00', km: 60 },
    { type: 'pause', title: 'Déjeuner', location: 'Restaurant Le Normand', start: '12:00', end: '12:45', km: 10 },
    { type: 'rdv', title: 'Client B', location: 'Lisieux', start: '14:00', end: '15:30', km: 50 },
    { type: 'obligation', title: 'Obligation familiale', location: 'Gouvix', start: '17:30', end: '18:30', km: 30 }
  ]);
}

function calculatePlan(events, socStart, socMin) {
  let soc = socStart;
  const steps = [];

  for (const ev of events) {
    if (ev.type === 'pause') {
      const hasStation = true;
      if (hasStation) {
        const powerKW = 150;
        const durationMin = (parseInt(ev.end.split(':')[0]) * 60 + parseInt(ev.end.split(':')[1])) -
                            (parseInt(ev.start.split(':')[0]) * 60 + parseInt(ev.start.split(':')[1]));
        const kwhAdded = powerKW * (durationMin / 60) * 0.7;
        const socGain = (kwhAdded / BATTERY_KWH) * 100;
        soc = Math.min(85, soc + socGain);
        steps.push({ action: 'Recharge midi', station: 'DC rapide', gain: socGain.toFixed(1), soc });
      }
    } else {
      const kwhNeeded = (ev.km * 20) / 100;
      const socDrop = (kwhNeeded / BATTERY_KWH) * 100;
      soc -= socDrop;
      steps.push({ action: ev.title, soc });
    }
  }

  if (soc < socMin) {
    steps.push({ action: 'Recharge complémentaire', note: 'Prévoir borne rapide avant retour', soc });
  }

  return steps;
}

function displayResult(plan) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<h2>Planification</h2>' +
    plan.map(step => `<p>${step.action} → SoC: ${step.soc.toFixed(1)}%</p>`).join('');
}

async function callAI(context) {
  const apiUrl = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1';
  const apiKey = 'TA_CLE_API_ICI';

  const prompt = `Tu es un planificateur de recharge pour Kia EV6 (84 kWh). Planning: ${JSON.stringify(context.events)} SoC départ: ${context.socStart}%, SoC min retour: ${context.socMin}%. Bornes: ${JSON.stringify(context.stations)}. Règles: Recharge midi si borne ≤300m, priorité DC ≥150kW, AC si DC absente, temps minimal.`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ inputs: prompt })
  });

  const data = await response.json();
  return data.generated_text || 'Pas de réponse IA.';
}