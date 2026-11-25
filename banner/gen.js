'use strict';
// Banner background photos on fal.ai (FLUX.3, 21:9 → cropped to 3:1 in banner.html).
const path = require('path');
const { run, download } = require('../video/fal');
const PROMPT = 'Wide cinematic photograph, Christmas morning in a modest neighborhood community center, a diverse group of happy children aged 5 to 9 opening donated wrapped presents, laughing, hugging new teddy bears, holding a wooden toy train and a toy rocket, simple everyday clothes, torn red and green wrapping paper and gold ribbons on the floor, warm golden fairy lights and a decorated Christmas tree, joyful candid moment, dignified and heartwarming, shallow depth of field, photorealistic, the children fill the left and center of the frame, the right third of the frame is darker and calm with soft warm bokeh, no text, no logos, no watermark';
(async () => {
  const jobs = [1, 2].map(async i => {
    const r = await run('blackforestlabs/flux-3/text-to-image', { prompt: PROMPT, aspect_ratio: '21:9', resolution: '2k', output_format: 'jpeg' });
    await download(r.images[0].url, path.join(__dirname, `bg-${i}.jpg`));
    console.log('bg', i, r.images[0].width + 'x' + r.images[0].height);
  });
  const res = await Promise.allSettled(jobs);
  res.forEach(x => x.status === 'rejected' && console.error('FAILED', x.reason.message));
})();
