function setYear(){
  const y = new Date().getFullYear();
  const n = document.getElementById('year');
  if(n) n.textContent = String(y);
}

function loadSelection(){
  const raw = localStorage.getItem('freeshop.selectedShop');
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function initEmail(){
  if(!('emailjs' in window)) return;
  emailjs.init({ publicKey: 'lWY_RsjjpJAv6hmVo' });
}

function bindForm(selected){
  const IMGBB_API_KEY = '9c558dd448926670ca31c1faccc037a1';
  const ATTACHMENT_LIMIT_BYTES = 30_000; // <=30KB send as attachment
  const MAX_UPLOAD_BYTES = 1_000_000;    // up to 1MB upload to imgbb
  const form = document.getElementById('orderForm');
  const status = document.getElementById('formStatus');
  const submitBtn = document.getElementById('submitBtn');
  const imageInput = document.getElementById('image');
  const userAddressInput = document.getElementById('userAddress');
  const userAddressHidden = document.getElementById('user_address_hidden');
  const itemsField = document.getElementById('itemsField');
  const itemsTextarea = document.getElementById('items');
  const imageField = document.getElementById('imageField');
  const modeNo = document.getElementById('modeNo');
  const modeYes = document.getElementById('modeYes');

  function syncAddress(){
    userAddressHidden.value = userAddressInput.value || '';
  }
  userAddressInput.addEventListener('input', syncAddress);
  syncAddress();

  // toggle UI between image and text modes
  function toggleItemsByImage(){
    const useImageMode = modeYes.checked;
    imageField.style.display = useImageMode ? '' : 'none';
    itemsField.style.display = useImageMode ? 'none' : '';
    if(useImageMode){
      itemsTextarea.removeAttribute('required');
    } else {
      itemsTextarea.setAttribute('required', 'required');
      if(imageInput && imageInput.files?.length){
        const dt = new DataTransfer();
        imageInput.files = dt.files;
      }
    }
  }
  imageInput.addEventListener('change', toggleItemsByImage);
  modeNo.addEventListener('change', toggleItemsByImage);
  modeYes.addEventListener('change', toggleItemsByImage);
  toggleItemsByImage();

  // Utility: compress image to target max bytes/dimensions
  async function compressToTarget(file, maxBytes, maxW, maxH){
    if(!file) return null;
    const MAX_BYTES = maxBytes;
    const MAX_W = maxW, MAX_H = maxH;

    const img = await new Promise((resolve, reject)=>{
      const i = new Image();
      i.onload = ()=>resolve(i);
      i.onerror = reject;
      const r = new FileReader();
      r.onload = ()=>{ i.src = r.result; };
      r.onerror = reject;
      r.readAsDataURL(file);
    });

    const ratio = Math.min(1, MAX_W / img.width, MAX_H / img.height);
    const w = Math.max(1, Math.round(img.width * ratio));
    const h = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    let quality = 0.8;
    let blob = await new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
    while(blob && blob.size > MAX_BYTES && quality > 0.35){
      quality -= 0.07;
      blob = await new Promise(res=>canvas.toBlob(res, 'image/jpeg', quality));
    }
    if(!blob) return null;
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
  }

  // Upload to imgbb and return hosted URL
  async function uploadToImgbb(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = async () => {
        try{
          const base64 = String(reader.result).replace(/^data:[^;]+;base64,/, '');
          const body = new URLSearchParams();
          body.set('key', IMGBB_API_KEY);
          body.set('image', base64);
          status.textContent = 'Uploading image…';
          const res = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
          });
          status.textContent = '';
          if(!res.ok){
            const txt = await res.text();
            return reject(new Error('imgbb_upload_failed: '+txt));
          }
          const json = await res.json();
          const url = json?.data?.display_url || json?.data?.url || json?.data?.url_viewer;
          if(!url) return reject(new Error('imgbb_no_url'));
          resolve(url);
        }catch(e){ reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // --- form submission ---
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    status.textContent = 'Sending…';
    submitBtn.disabled = true;
    let attemptedWithoutImage = false;

    const trySend = async ()=>{
      try{
        // Handle image according to size thresholds
        if(imageInput?.files?.[0]){
          const file = imageInput.files[0];
          // If <=30KB send as attachment; else upload to imgbb (compress to <=1MB if needed)
          if(file.size > ATTACHMENT_LIMIT_BYTES){
            let toUpload = file;
            if(file.size > MAX_UPLOAD_BYTES){
              const maybeCompressed = await compressToTarget(file, MAX_UPLOAD_BYTES, 1600, 1600);
              if(!maybeCompressed){
                throw new Error('image_too_large');
              }
              toUpload = maybeCompressed;
            }
            // Upload to imgbb
            const url = await uploadToImgbb(toUpload);
            // Ensure hidden image_url field exists and set it
            let imageUrlHidden = document.getElementById('image_url');
            if(!imageUrlHidden){
              imageUrlHidden = document.createElement('input');
              imageUrlHidden.type = 'hidden';
              imageUrlHidden.name = 'image_url';
              imageUrlHidden.id = 'image_url';
              form.appendChild(imageUrlHidden);
            }
            imageUrlHidden.value = url;
            // Clear the image file so EmailJS won't attach it
            const dt = new DataTransfer();
            imageInput.files = dt.files;
          } else {
            // attachment path: clear any previous image_url
            const h = document.getElementById('image_url');
            if(h) h.value = '';
          }
        }

        const useImageMode = modeYes.checked;
        const hasImage = imageInput?.files?.length > 0;
        const hasText = (itemsTextarea.value || '').trim().length > 0;
        if(useImageMode && !hasImage){
          // If user chose image mode but we uploaded externally, allow proceed if image_url present
          const h = document.getElementById('image_url');
          if(!(h && h.value)){
            alert('Please upload an image of your list.');
            throw new Error('missing_content');
          }
        }
        if(!useImageMode && !hasText){
          alert('Please type your items.');
          throw new Error('missing_content');
        }

        await emailjs.sendForm('service_t9pgs0n', 'template_rct7t0s', form);
        status.textContent = '';
        alert('✅ Order submitted successfully! The shop will contact you soon.');
        form.reset();
        toggleItemsByImage();
        syncAddress();

      }catch(err){
        status.textContent = '';
        console.error('Email send failed', err);

        const hasImageNow = imageInput?.files?.length > 0;
        const isSizeOrUnprocessable =
          (err && (err.status === 413 || err.status === 422)) ||
          /413|422/i.test(String(err)) ||
          /Content Too Large|Unprocessable/i.test(err?.message || '');

        if(!attemptedWithoutImage && hasImageNow && isSizeOrUnprocessable){
          attemptedWithoutImage = true;
          const dt = new DataTransfer();
          imageInput.files = dt.files; // clear
          modeNo.checked = true;
          toggleItemsByImage();
          alert('Your image was too large. Sending without the image.');
          return trySend();
        }

        if(err.message === 'image_too_large') {
          alert('Failed: image too large. Please choose an image ≤ 1 MB.');
        } else if(err.message === 'missing_content') {
          /* already alerted */
        } else {
          alert('Failed to send order. Please try again.');
        }
      } finally {
        submitBtn.disabled = false;
      }
    };
    await trySend();
  });
}

function start(){
  setYear();
  initEmail();
  const sel = loadSelection();
  if(!sel){
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('shopName').textContent = sel.shop.name;
  document.getElementById('shopAddress').textContent = sel.shop.address;
  document.getElementById('userAddress').value = sel.user.address || '';

  document.getElementById('shop_name').value = sel.shop.name;
  document.getElementById('shop_email').value = sel.shop.email;
  document.getElementById('shop_address').value = sel.shop.address;
  document.getElementById('user_address_hidden').value = sel.user.address || '';
  document.getElementById('user_lat').value = sel.user.lat ?? '';
  document.getElementById('user_lng').value = sel.user.lng ?? '';

  bindForm(sel);
}

document.addEventListener('DOMContentLoaded', start);
