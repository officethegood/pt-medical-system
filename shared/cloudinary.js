// PT Medical System — Cloudinary Image Upload
// Requires: config.js loaded before this

async function uploadToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append('folder', 'pt-medical/' + folder);

  const res = await fetch('https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/image/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

// Upload base64 data URL to Cloudinary
async function uploadBase64ToCloudinary(base64DataUrl, folder) {
  const formData = new FormData();
  formData.append('file', base64DataUrl);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append('folder', 'pt-medical/' + folder);

  const res = await fetch('https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/image/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}

// Upload any file type (image OR PDF) — uses /auto/upload endpoint
// Returns full response object ({ secure_url, resource_type, public_id, bytes, format, ... })
async function uploadAutoToCloudinary(file, folder) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append('folder', 'pt-medical/' + folder);

  const res = await fetch('https://api.cloudinary.com/v1_1/' + CONFIG.CLOUDINARY_CLOUD_NAME + '/auto/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}
