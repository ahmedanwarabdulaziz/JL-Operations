// Lead Email Templates
export const generateMissingPictureEmail = (leadData) => {
  const customerName = leadData.name || 'there';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>More Info Needed for Your Quote</title>
  <style>
    /* --- Base Styles --- */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      margin: 0;
      padding: 0;
      background-color: #f4f4f7;
      color: #333333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 680px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }

    /* --- Banner --- */
    .banner img {
      display: block;
      width: 100%;
      height: auto;
      border-bottom: 1px solid #e0e0e0;
    }

    /* --- Title Bar (Gold) --- */
    .title-bar {
      background-color: #c5931a;
      color: #ffffff;
      text-align: center;
      padding: 18px 0;
    }
    .title-bar h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* --- Content --- */
    .content {
      padding: 35px 40px;
      line-height: 1.65;
      font-size: 16px;
      color: #444444;
    }
    .content p {
      margin-bottom: 18px;
    }

    /* --- Button --- */
    .button {
      display: inline-block;
      background-color: #c5931a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 25px;
      border-radius: 4px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #b08218;
    }

    /* --- Footer --- */
    .footer {
      text-align: center;
      padding: 30px;
      font-size: 13px;
      color: #888888;
      background-color: #f4f4f7;
      border-top: 1px solid #e0e0e0;
    }
    .social-icons {
      margin-bottom: 15px;
    }
    .social-icons a {
      display: inline-block;
      margin: 0 8px;
      text-decoration: none;
    }
    .social-icons img {
      width: 24px;
      height: auto;
      vertical-align: middle;
      border: 0;
    }
    .footer strong {
      color: #555555;
    }
  </style>
</head>
<body>
  <div class="email-container">

    <!-- Banner -->
    <div class="banner">
      <img src="https://www.jlupholstery.com/wp-content/uploads/2025/04/jsdsda.png"
           alt="JL Upholstery Banner">
    </div>

    <!-- Title Bar -->
    <div class="title-bar">
      <h1>More Info Needed</h1>
    </div>

    <!-- Main Content -->
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>It looks like the pictures of your furniture weren't attached.</p>
      <p>To provide you with an accurate quote, we'll need to see the items.</p>
      <p>You can simply reply to this email with the photos, or text them to us at <strong>647‑261‑4116</strong>.</p>
      <p>Not sure what you should send? Call us now!</p>

      <!-- Call‑to‑Action Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="tel:6472614116" class="button">Call Now</a>
      </div>
    </div>

    <!-- Footer with Logo, Notice & Social Icons -->
    <div class="footer">
      <!-- Logo & Notice -->
      <div style="margin-bottom:20px; text-align:center;">
        <img src="https://www.jlupholstery.com/wp-content/uploads/2022/09/logo.png"
             alt="JL Upholstery Logo"
             style="height:50px; display:block; margin:0 auto 10px;">
        <p style="margin:0; font-size:14px; color:#555555;">
          jlupholstery&nbsp;|&nbsp;Milton, ON, Canada
        </p>
        <p style="margin:5px 0 0; font-size:12px; color:#888888;">
          You've received this because you've submitted a Quotation Form on jlupholstery.com
        </p>
      </div>

      <!-- Social Icons -->
      <div class="social-icons">
        <a href="https://www.jlupholstery.com/" target="_blank" rel="noopener">
          <img src="https://img.icons8.com/ios-filled/24/c5931a/globe.png" alt="Website">
        </a>
        <a href="https://www.facebook.com/jlupholstery.ca" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook">
        </a>
        <a href="https://www.instagram.com/jl_upholstery/" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram">
        </a>
        <a href="https://ca.pinterest.com/jlupholstery2022/?actingBusinessId=920564117490699151"
           target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" alt="Pinterest">
        </a>
      </div>

      <p style="margin-top:20px; font-size:13px; color:#888888;">
        &copy; 2025 JL Upholstery. All Rights Reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
};

export const generateMissingFoamEmail = (leadData) => {
  const customerName = leadData.name || 'there';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>More Info Needed for Your Quote</title>
  <style>
    /* --- Base Styles --- */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      margin: 0;
      padding: 0;
      background-color: #f4f4f7;
      color: #333333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 680px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }

    /* --- Banner --- */
    .banner img {
      display: block;
      width: 100%;
      height: auto;
      border-bottom: 1px solid #e0e0e0;
    }

    /* --- Title Bar (Gold) --- */
    .title-bar {
      background-color: #c5931a;
      color: #ffffff;
      text-align: center;
      padding: 18px 0;
    }
    .title-bar h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* --- Content --- */
    .content {
      padding: 35px 40px;
      line-height: 1.65;
      font-size: 16px;
      color: #444444;
    }
    .content p {
      margin-bottom: 18px;
    }

    /* --- Button --- */
    .button {
      display: inline-block;
      background-color: #c5931a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 25px;
      border-radius: 4px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #b08218;
    }

    /* --- Footer --- */
    .footer {
      text-align: center;
      padding: 30px;
      font-size: 13px;
      color: #888888;
      background-color: #f4f4f7;
      border-top: 1px solid #e0e0e0;
    }
    .social-icons {
      margin-bottom: 15px;
    }
    .social-icons a {
      display: inline-block;
      margin: 0 8px;
      text-decoration: none;
    }
    .social-icons img {
      width: 24px;
      height: auto;
      vertical-align: middle;
      border: 0;
    }
    .footer strong {
      color: #555555;
    }
  </style>
</head>
<body>
  <div class="email-container">

    <!-- Banner -->
    <div class="banner">
      <img src="https://www.jlupholstery.com/wp-content/uploads/2025/04/jsdsda.png" alt="JL Upholstery Banner">
    </div>

    <!-- Title Bar -->
    <div class="title-bar">
      <h1>More Info Needed</h1>
    </div>

    <!-- Main Content -->
    <div class="content">
      <p>Hi ${customerName},</p>
      <p>It looks like we'll need a bit more information to get started.</p>
      <p>To provide you with an accurate quote, please send us a <strong>few photos of the cushion</strong> along with <strong>approximate measurements</strong>.</p>
      <p>You can simply reply to this email with the photos or text them to us at <strong>647‑261‑4116</strong>.</p>
      <p>Not sure what you should send? Call us now!</p>

      <!-- Call‑to‑Action Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="tel:6472614116" class="button">Call Now</a>
      </div>
    </div>

    <!-- Footer with Logo, Notice & Social Icons -->
    <div class="footer">
      <!-- Logo & Notice -->
      <div style="margin-bottom:20px; text-align:center;">
        <img src="https://www.jlupholstery.com/wp-content/uploads/2022/09/logo.png"
             alt="JL Upholstery Logo"
             style="height:50px; display:block; margin:0 auto 10px;">
        <p style="margin:0; font-size:14px; color:#555555;">
          jlupholstery&nbsp;|&nbsp;Milton, ON, Canada
        </p>
        <p style="margin:5px 0 0; font-size:12px; color:#888888;">
          You've received this because you've submitted a Quotation Form on jlupholstery.com
        </p>
      </div>

      <!-- Social Icons -->
      <div class="social-icons">
        <a href="https://www.jlupholstery.com/" target="_blank" rel="noopener">
          <img src="https://img.icons8.com/ios-filled/24/c5931a/globe.png" alt="Website">
        </a>
        <a href="https://www.facebook.com/jlupholstery.ca" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook">
        </a>
        <a href="https://www.instagram.com/jl_upholstery/" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram">
        </a>
        <a href="https://ca.pinterest.com/jlupholstery2022/?actingBusinessId=920564117490699151" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" alt="Pinterest">
        </a>
      </div>

      <p style="margin-top:20px; font-size:13px; color:#888888;">
        &copy; 2025 JL Upholstery. All Rights Reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
};

export const generateMissingBenchCushionEmail = (leadData) => {
  const customerName = leadData.name || 'there';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>More Info Needed for Your Quote</title>
  <style>
    /* --- Base Styles --- */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol';
      margin: 0;
      padding: 0;
      background-color: #f4f4f7;
      color: #333333;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-container {
      max-width: 680px;
      margin: 30px auto;
      background-color: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
    }

    /* --- Banner --- */
    .banner img {
      display: block;
      width: 100%;
      height: auto;
      border-bottom: 1px solid #e0e0e0;
    }

    /* --- Title Bar (Gold) --- */
    .title-bar {
      background-color: #c5931a;
      color: #ffffff;
      text-align: center;
      padding: 18px 0;
    }
    .title-bar h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* --- Content --- */
    .content {
      padding: 35px 40px;
      line-height: 1.65;
      font-size: 16px;
      color: #444444;
    }
    /* New intro style */
    .content .intro {
      font-size: 18px;
      font-weight: 600;
      color: #333333;
      margin-bottom: 18px;
    }
    .content p {
      margin-bottom: 18px;
    }

    /* --- Button --- */
    .button {
      display: inline-block;
      background-color: #c5931a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 25px;
      border-radius: 4px;
      font-size: 16px;
    }
    .button:hover {
      background-color: #b08218;
    }

    /* --- Footer --- */
    .footer {
      text-align: center;
      padding: 30px;
      font-size: 13px;
      color: #888888;
      background-color: #f4f4f7;
      border-top: 1px solid #e0e0e0;
    }
    .social-icons {
      margin-bottom: 15px;
    }
    .social-icons a {
      display: inline-block;
      margin: 0 8px;
      text-decoration: none;
    }
    .social-icons img {
      width: 24px;
      height: auto;
      vertical-align: middle;
      border: 0;
    }
    .footer strong {
      color: #555555;
    }
  </style>
</head>
<body>
  <div class="email-container">

    <!-- Banner -->
    <div class="banner">
      <img src="https://www.jlupholstery.com/wp-content/uploads/2025/04/jsdsda.png"
           alt="JL Upholstery Banner">
    </div>

    <!-- Title Bar -->
    <div class="title-bar">
      <h1>More Info Needed</h1>
    </div>

    <!-- Main Content -->
    <div class="content">
      <p>Hi ${customerName},</p>
      <!-- This line is now larger and bold -->
      <p class="intro">It looks like we'll need a bit more information to get started.</p>
      <p>To provide you with an accurate quote, please send us a <strong>photo of the area where the cushion will go</strong>, along with <strong>approximate measurements</strong>.</p>
      <p>You can simply reply to this email with the photos, or text them to us at <strong>647‑261‑4116</strong>.</p>

      <!-- Call‑to‑Action Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="tel:6472614116" class="button">Call Now</a>
      </div>
    </div>

    <!-- Footer with Logo, Notice & Social Icons -->
    <div class="footer">
      <div style="margin-bottom:20px; text-align:center;">
        <img src="https://www.jlupholstery.com/wp-content/uploads/2022/09/logo.png"
             alt="JL Upholstery Logo"
             style="height:50px; display:block; margin:0 auto 10px;">
        <p style="margin:0; font-size:14px; color:#555555;">
          jlupholstery&nbsp;|&nbsp;Milton, ON, Canada
        </p>
        <p style="margin:5px 0 0; font-size:12px; color:#888888;">
          You've received this because you've submitted a Quotation Form on jlupholstery.com
        </p>
      </div>

      <div class="social-icons">
        <a href="https://www.jlupholstery.com/" target="_blank" rel="noopener">
          <img src="https://img.icons8.com/ios-filled/24/c5931a/globe.png" alt="Website">
        </a>
        <a href="https://www.facebook.com/jlupholstery.ca" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook">
        </a>
        <a href="https://www.instagram.com/jl_upholstery/" target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram">
        </a>
        <a href="https://ca.pinterest.com/jlupholstery2022/?actingBusinessId=920564117490699151"
           target="_blank" rel="noopener">
          <img src="https://cdn-icons-png.flaticon.com/24/733/733558.png" alt="Pinterest">
        </a>
      </div>

      <p style="margin-top:20px; font-size:13px; color:#888888;">
        &copy; 2025 JL Upholstery. All Rights Reserved.
      </p>
    </div>

  </div>
</body>
</html>`;
};

// Email template options
export const emailTemplates = [
  {
    id: 'missing_picture',
    name: 'Missing Picture',
    description: 'When customer forgot to attach images',
    subject: 'More Info Needed - Pictures Required',
    generateTemplate: generateMissingPictureEmail
  },
  {
    id: 'missing_foam',
    name: 'Missing Foam/Cushion',
    description: 'When customer needs to send cushion photos',
    subject: 'More Info Needed - Cushion Photos Required',
    generateTemplate: generateMissingFoamEmail
  },
  {
    id: 'missing_bench_cushion',
    name: 'Missing Bench Cushion',
    description: 'When customer needs to send bench cushion area photos',
    subject: 'More Info Needed - Bench Cushion Area Photos',
    generateTemplate: generateMissingBenchCushionEmail
  }
]; 