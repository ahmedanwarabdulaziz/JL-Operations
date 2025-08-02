// ImgBB API Configuration
export const IMGBB_CONFIG = {
  API_KEY: process.env.REACT_APP_IMGBB_API_KEY || '2b0b744973c972708bc1f0ee99eac407',
  UPLOAD_URL: 'https://api.imgbb.com/1/upload'
};

export const uploadImageToImgBB = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch(`${IMGBB_CONFIG.UPLOAD_URL}?key=${IMGBB_CONFIG.API_KEY}`, {
    method: 'POST',
    body: formData
  });

  return response.json();
}; 