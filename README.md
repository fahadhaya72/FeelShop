# FreeShop – Multi-shop Grocery Ordering (Frontend-only)

A client-side web app to find nearby shops, view them on a map, and place orders directly by email.

- Geolocation + Nominatim reverse geocoding
- Leaflet map with user + shop markers
- Shop list sorted by distance; select a shop to order
- Order form sends via EmailJS (no backend)
- Mobile-first dark theme with orange accents

## Live Requirements
- Serve over HTTPS or `localhost` for geolocation to work
- EmailJS account with service + template configured

## Quick Start
1. Install a static server (examples):
   - VS Code: Live Server extension
   - Python: `python -m http.server` (from project folder)
2. Open `http://localhost:<port>/index.html` and allow location.
3. Select a shop → fill in order → submit.

## Configuration
- `shops.json`
  - Add shops as objects: `{ name, lat, lng, address, email }`
  - Example:
```json
[
  {
    "name": "Ismail Muslim Sabar Kirana",
    "lat": 22.767965,
    "lng": 73.609662,
    "address": "Near Jamali Hall , Idgah Road , Godhra",
    "email": "smr69413@gmail.com"
  }
]
```

- `order.js`
  - EmailJS credentials:
    - Service ID: `service_t9pgs0n`
    - Template ID: `template_rct7t0s`
    - Public Key: `lWY_RsjjpJAv6hmVo`
  - File field name is `image`. Template “To” must be `{{shop_email}}` to email the selected shop.

- `script.js`
  - Nominatim reverse geocode includes contact email: `&email=fuelfluxai@gmail.com`

## Vercel Deployment
1. Push these files to a Git repository (GitHub/GitLab/Bitbucket).
2. In Vercel:
   - New Project → Import your repo
   - Framework Preset: “Other” (static)
   - Build Command: None
   - Output Directory: `/` (root)
3. Deploy. The site will be served over HTTPS by default.

## Testing Checklist
- Index page
  - Allow location; see your address in the top bar
  - Leaflet map renders with your marker
  - Shop marker appears for each `shops.json` entry
  - Shop cards show name, address, and distance
- Selection → Order
  - After selecting a shop, `order.html` shows shop info + your detected address
  - Enter items, phone, optionally upload an image
  - Submit: Success alert appears and email is received at the shop email
- Email contents
  - Email includes: items, phone, shop_name, shop_address, user_address, user_lat, user_lng
  - If image uploaded, it’s attached

## Notes
- No backend or database is required
- Reverse geocoding results are cached in `sessionStorage`
- If you add many shops, keep coordinates accurate for correct distance sorting
- For support or changes, edit the files directly; no build step needed
