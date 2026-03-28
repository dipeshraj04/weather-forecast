// Modern, accessible, live-updating weather dashboard

const cityInput = document.getElementById('city-input');
const searchForm = document.getElementById('search-form');
const useLocationButton = document.getElementById('use-location');
const statusText = document.getElementById('status-text');
const unitToggle = document.getElementById('unit-toggle');
const themeToggle = document.getElementById('theme-toggle');
const liveDateTime = document.getElementById('live-date-time');

const locationEl = document.getElementById('location');
const conditionEl = document.getElementById('condition');
const temperatureEl = document.getElementById('temperature');
const feelsEl = document.getElementById('feels-like');
const highEl = document.getElementById('high');
const lowEl = document.getElementById('low');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const forecastContainer = document.getElementById('forecast-cards');

const DEFAULT_CITY = 'Kathmandu';
const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const API_KEY = 'vck_5yqGgJdVxOPutE8RImx4xNDEEphTw4ALsTskCviTFs1XyE3wXJ3Gsw4h'; // User provided key

let units = localStorage.getItem('weather-units') || 'metric';
let theme = localStorage.getItem('weather-theme') || 'dark';
let currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; // Default to local browser timezone
let lastQuery = null; // Object to store last search details for refresh
let refreshTimer;
let clockTimer;

function setStatus(message, type = 'info') {
    statusText.textContent = message;
    statusText.classList.remove('error', 'success');
    if (type === 'error') statusText.classList.add('error');
    if (type === 'success') statusText.classList.add('success');
}

function formatTemp(value) {
    if (value === undefined || value === null) return '--°';
    return `${Math.round(value)}°${units === 'metric' ? 'C' : 'F'}`;
}

function formatWind(value) {
    if (value === undefined || value === null) return '--';
    const unitLabel = units === 'metric' ? 'km/h' : 'mph'; 
    return `${Math.round(value)} ${unitLabel}`;
}

function updateUnitToggle() {
    unitToggle.textContent = units === 'metric' ? '°C' : '°F';
}

function updateThemeToggle() {
    themeToggle.textContent = theme === 'dark' ? 'Dark' : 'Light';
}

function applyTheme() {
    document.body.dataset.theme = theme;
    updateThemeToggle();
}

function updateClock() {
    try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat(undefined, {
            timeZone: currentTimezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(now);
        liveDateTime.textContent = formatted;
    } catch(e) {
        liveDateTime.textContent = '';
    }
}

function startClock() {
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(updateClock, 1000);
}

// Convert WMO Weather codes to descriptions and simple emojis
function getWeatherCodeDetails(code) {
    const codes = {
        0: { desc: 'Clear sky', icon: '☀️' },
        1: { desc: 'Mainly clear', icon: '🌤️' },
        2: { desc: 'Partly cloudy', icon: '⛅' },
        3: { desc: 'Overcast', icon: '☁️' },
        45: { desc: 'Fog', icon: '🌫️' },
        48: { desc: 'Depositing rime fog', icon: '🌫️' },
        51: { desc: 'Light drizzle', icon: '🌧️' },
        53: { desc: 'Moderate drizzle', icon: '🌧️' },
        55: { desc: 'Dense drizzle', icon: '🌧️' },
        56: { desc: 'Light freezing drizzle', icon: '🌧️' },
        57: { desc: 'Dense freezing drizzle', icon: '🌧️' },
        61: { desc: 'Slight rain', icon: '🌧️' },
        63: { desc: 'Moderate rain', icon: '🌧️' },
        65: { desc: 'Heavy rain', icon: '🌧️' },
        66: { desc: 'Light freezing rain', icon: '🌧️' },
        67: { desc: 'Heavy freezing rain', icon: '🌧️' },
        71: { desc: 'Slight snow fall', icon: '🌨️' },
        73: { desc: 'Moderate snow fall', icon: '🌨️' },
        75: { desc: 'Heavy snow fall', icon: '🌨️' },
        77: { desc: 'Snow grains', icon: '🌨️' },
        80: { desc: 'Slight rain showers', icon: '🌦️' },
        81: { desc: 'Moderate rain showers', icon: '🌦️' },
        82: { desc: 'Violent rain showers', icon: '🌦️' },
        85: { desc: 'Slight snow showers', icon: '🌨️' },
        86: { desc: 'Heavy snow showers', icon: '🌨️' },
        95: { desc: 'Thunderstorm', icon: '⛈️' },
        96: { desc: 'Thunderstorm with slight hail', icon: '⛈️' },
        99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' }
    };
    return codes[code] || { desc: 'Unknown', icon: '❓' };
}

function renderCurrentWeather(data, label) {
    locationEl.textContent = label;
    
    const current = data.current;
    const daily = data.daily;
    const weatherDetails = getWeatherCodeDetails(current.weather_code);
    
    conditionEl.textContent = `${weatherDetails.icon} ${weatherDetails.desc}`;
    temperatureEl.textContent = formatTemp(current.temperature_2m);
    feelsEl.textContent = `Feels like ${formatTemp(current.apparent_temperature)}`;
    
    // Today's high and low
    highEl.textContent = formatTemp(daily.temperature_2m_max[0]);
    lowEl.textContent = formatTemp(daily.temperature_2m_min[0]);
    
    humidityEl.textContent = `${current.relative_humidity_2m}%`;
    windEl.textContent = formatWind(current.wind_speed_10m);
    
    if (data.timezone) {
        currentTimezone = data.timezone;
    }
    updateClock();
}

function renderForecast(daily) {
    forecastContainer.innerHTML = '';
    if (!daily || !daily.time || daily.time.length === 0) {
        forecastContainer.innerHTML = '<p class="muted">No forecast available.</p>';
        return;
    }

    // Show next 5 days
    const nextDays = daily.time.slice(1, 6);
    nextDays.forEach((dateStr, index) => {
        // Offset index by 1 because we sliced
        const i = index + 1;
        
        const card = document.createElement('article');
        card.className = 'forecast-card';

        const dateParts = dateStr.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const dayStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        
        const details = getWeatherCodeDetails(daily.weather_code[i]);
        
        card.innerHTML = `
            <div class="day">${dayStr}</div>
            <div style="font-size: 2rem; margin: 0.2rem 0;">${details.icon}</div>
            <div>${details.desc}</div>
            <div class="temp-high">${formatTemp(daily.temperature_2m_max[i])}</div>
            <div class="temp-low">Low ${formatTemp(daily.temperature_2m_min[i])}</div>
        `;

        forecastContainer.appendChild(card);
    });
}

// Fetch geocoordinates for a city using Open-Meteo Geocoding
async function geocodeCity(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding service unavailable.');
    const data = await res.json();
    if (!data.results || data.results.length === 0) throw new Error('City not found.');
    return data.results[0];
}

// Fetch weather for lat/lon using Open-Meteo Weather API
async function fetchWeatherByCoords(lat, lon, label, announce = true) {
    if (announce) setStatus(label ? `Looking up ${label}…` : 'Loading live data…');
    
    const tempUnit = units === 'metric' ? 'celsius' : 'fahrenheit';
    const windUnit = units === 'metric' ? 'kmh' : 'mph';
    
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Unable to load weather data right now.');

        const data = await res.json();
        
        lastQuery = { type: 'coords', lat, lon, label };
        renderCurrentWeather(data, label);
        renderForecast(data.daily);
        setStatus('Live and auto-refreshing.', 'success');
        scheduleRefresh();
    } catch (err) {
        setStatus(err.message, 'error');
        throw err;
    }
}

async function fetchWeatherByCityStr(city) {
    setStatus(`Looking up ${city}…`);
    try {
        const geoInfo = await geocodeCity(city);
        const label = `${geoInfo.name}${geoInfo.country_code ? ', ' + geoInfo.country_code : ''}`;
        lastQuery = { type: 'city', city, label }; // Keep original lookup 
        await fetchWeatherByCoords(geoInfo.latitude, geoInfo.longitude, label, false);
    } catch (err) {
        setStatus(err.message, 'error');
        throw err;
    }
}

async function refreshFromLast(silent = true) {
    if (!lastQuery) return;
    try {
        if (!silent) setStatus('Refreshing…');
        if (lastQuery.type === 'city') {
            await fetchWeatherByCityStr(lastQuery.city);
        } else {
            await fetchWeatherByCoords(lastQuery.lat, lastQuery.lon, lastQuery.label, false);
        }
    } catch (err) {
        // already handled by inner functions
    }
}

function scheduleRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshFromLast(true), REFRESH_MS);
}

function attachEvents() {
    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const city = cityInput.value.trim();
        await fetchWeatherByCityStr(city);
    });

    useLocationButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            setStatus('Geolocation not supported in this browser.', 'error');
            return;
        }
        setStatus('Reading your location…');
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                await fetchWeatherByCoords(latitude, longitude, 'Your Location', false);
            } catch (err) {
                 // Already handled
            }
        }, (err) => {
            setStatus('Location permission denied. Try search instead.', 'error');
        });
    });

    unitToggle.addEventListener('click', async () => {
        units = units === 'metric' ? 'imperial' : 'metric';
        localStorage.setItem('weather-units', units);
        updateUnitToggle();
        await refreshFromLast(false);
    });

    themeToggle.addEventListener('click', () => {
        theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('weather-theme', theme);
        applyTheme();
    });

    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshFromLast(true);
        }
    });
}

function init() {
    applyTheme();
    updateUnitToggle();
    startClock();
    attachEvents();

    // Try geolocation first; fall back to default city
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                fetchWeatherByCoords(pos.coords.latitude, pos.coords.longitude, 'Your Location', false)
                    .catch(() => fetchWeatherByCityStr(DEFAULT_CITY));
            },
            () => {
                // If denied, fallback silently to default city
                fetchWeatherByCityStr(DEFAULT_CITY);
            }
        );
    } else {
        fetchWeatherByCityStr(DEFAULT_CITY);
    }
}

init();