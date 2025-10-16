# Cloudinary Setup Guide

## Current Status: Real Cloudinary Uploads Enabled ✅

The system is now configured to use your **"JL website"** upload preset for real Cloudinary uploads!

### Current Configuration:
- **Cloud Name**: `ddajmhqxm`
- **Upload Preset**: `JL website`
- **Status**: Real uploads enabled

### Upload Preset Configuration:
To optimize uploads, configure your "JL website" preset with:
- **Eager Transformations**: Add transformations like `w_400,h_300,c_fill,f_auto,q_auto`
- **Auto Format**: Enable `f_auto` for optimal format delivery
- **Auto Quality**: Enable `q_auto` for optimal quality
- **Folder**: Set to `website-images` for organization

### Environment Variables (Optional)

Create a `.env.local` file in your project root:

```env
REACT_APP_CLOUDINARY_CLOUD_NAME=ddajmhqxm
REACT_APP_CLOUDINARY_API_KEY=575976478374339
REACT_APP_CLOUDINARY_UPLOAD_PRESET=JL website
```

**Note**: The API secret is not needed for unsigned uploads and should never be exposed in frontend code.

### 4. How It Works

1. **Upload**: Images are uploaded directly to Cloudinary using unsigned uploads
2. **Metadata**: Image information is stored in Firebase for the tag system
3. **Display**: Images are displayed using Cloudinary URLs
4. **Deletion**: Currently handled as soft delete in Firebase (Cloudinary deletion requires backend)

### 5. Security Notes

- Upload presets are unsigned for direct frontend uploads
- API secret is not exposed in frontend code
- Image deletion from Cloudinary should be handled on the backend for security
- Consider implementing signed uploads for production use

### 6. Testing

Once the upload preset is created, you can test the image upload functionality in the website management panel at `/admin/website`.
