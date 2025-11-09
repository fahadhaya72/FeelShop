const state = { user: { lat: null, lng: null, address: null }, shops: [], map: null, markers: [] };

const els = {
  year: null,
  locationStatus: null,
  userAddressText: null,
  mapLoader: null,
  shopsContainer: null,
  shopsEmpty: null
};

function setYear(){
  const y = new Date().getFullYear();
  const n = document.getElementById('year');
  if(n) n.textContent = String(y);
}

function showLoader(show, text){
  if(!els.mapLoader) return;
  els.mapLoader.classList.toggle('show', !!show);
  if(text) els.mapLoader.textContent = text;
}

function kmDistance(lat1, lon1, lat2, lon2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

async function loadShops(){
  const res = await fetch('shops.json', { cache: 'no-cache' });
  if(!res.ok) throw new Error('Failed loading shops');
  state.shops = await res.json();
}

function cacheKey(lat, lng){
  const r = (v)=>Math.round(v*10000)/10000;
  return `revgeo:${r(lat)},${r(lng)}`;
}

async function reverseGeocode(lat, lng){
  const key = cacheKey(lat, lng);
  const cached = sessionStorage.getItem(key);
  if(cached) return JSON.parse(cached);
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&email=fuelfluxai@gmail.com`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if(!res.ok) throw new Error('Reverse geocoding failed');
  const data = await res.json();
  const addr = data.display_name || '';
  const out = { address: addr };
  sessionStorage.setItem(key, JSON.stringify(out));
  return out;
}

function initMap(lat, lng){
  if(state.map){
    state.map.setView([lat,lng], 14);
    return;
  }
  state.map = L.map('map', { zoomControl: true, attributionControl: true }).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(state.map);
}

function addMarkers(){
  state.markers.forEach(m=>state.map.removeLayer(m));
  state.markers = [];
  const userMarker = L.marker([state.user.lat, state.user.lng]).addTo(state.map).bindPopup('You are here');
  state.markers.push(userMarker);
  state.shops.forEach(s => {
    const m = L.marker([s.lat, s.lng]).addTo(state.map).bindPopup(s.name);
    state.markers.push(m);
  });
}

function renderShops(){
  const cont = els.shopsContainer;
  cont.innerHTML = '';
  const withDist = state.shops.map(s => ({...s, distance: kmDistance(state.user.lat, state.user.lng, s.lat, s.lng)}))
    .sort((a,b)=>a.distance-b.distance);
  if(withDist.length===0){
    els.shopsEmpty.classList.remove('hidden');
    return;
  }
  els.shopsEmpty.classList.add('hidden');
  const frag = document.createDocumentFragment();
  withDist.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card shop-card';
    const title = document.createElement('div');
    title.className = 'shop-title';
    title.textContent = s.name;
    const addr = document.createElement('div');
    addr.className = 'muted';
    addr.textContent = s.address;
    const dist = document.createElement('div');
    dist.innerHTML = `<span class="badge">${s.distance.toFixed(2)} km</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = 'Select Shop';
    btn.addEventListener('click', ()=>onSelectShop(s));
    card.appendChild(title);
    card.appendChild(addr);
    card.appendChild(dist);
    card.appendChild(btn);
    frag.appendChild(card);
  });
  cont.appendChild(frag);
}

function onSelectShop(shop){
  const payload = {
    shop: { name: shop.name, address: shop.address, email: shop.email, lat: shop.lat, lng: shop.lng },
    user: { lat: state.user.lat, lng: state.user.lng, address: state.user.address }
  };
  localStorage.setItem('freeshop.selectedShop', JSON.stringify(payload));
  window.location.href = 'order.html';
}

async function start(){
  setYear();
  els.locationStatus = document.getElementById('locationStatus');
  els.userAddressText = document.getElementById('userAddress');
  els.mapLoader = document.getElementById('mapLoader');
  els.shopsContainer = document.getElementById('shopsContainer');
  els.shopsEmpty = document.getElementById('shopsEmpty');
  showLoader(true, 'Loading map…');
  try{
    await loadShops();
  }catch(e){
    showLoader(false);
  }
  if(!('geolocation' in navigator)){
    els.locationStatus.textContent = 'Geolocation not supported';
    showLoader(false);
    return;
  }
  els.locationStatus.textContent = 'Getting your position…';
  navigator.geolocation.getCurrentPosition(async (pos)=>{
    const { latitude, longitude } = pos.coords;
    state.user.lat = latitude; state.user.lng = longitude;
    initMap(latitude, longitude);
    addMarkers();
    try{
      const r = await reverseGeocode(latitude, longitude);
      state.user.address = r.address;
      els.userAddressText.textContent = r.address ? `· ${r.address}` : '';
      els.locationStatus.textContent = 'Your location:';
    }catch(err){
      els.locationStatus.textContent = 'Location detected';
    }
    addMarkers();
    renderShops();
    showLoader(false);
  }, (err)=>{
    els.locationStatus.textContent = 'Unable to get location';
    showLoader(false);
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
}

document.addEventListener('DOMContentLoaded', start);
