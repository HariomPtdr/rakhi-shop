# Save Budget Images

Please save the 5 images you provided in the chat to the following locations with these exact names:

1. **Under ₹50** image → `assets/images/budget-under-50.webp`
2. **₹50 - ₹100** image → `assets/images/budget-50-100.webp`
3. **₹100 - ₹200** image → `assets/images/budget-100-200.webp`
4. **₹200 - ₹300** image → `assets/images/budget-200-300.webp`
5. **Above ₹300** image → `assets/images/budget-above-300.webp`

## Steps:

1. Right-click on each image in the chat
2. Save as WebP format if possible (or JPG/PNG and convert to WebP)
3. Name them exactly as shown above
4. Place them in the `assets/images/` folder

## Image Mapping:

- **Image 5** (red thread flower rakhi) = `budget-under-50.webp`
- **Image 4** (red/white stone rakhi) = `budget-50-100.webp` 
- **Image 3** (green/white stone rakhi) = `budget-200-300.webp`
- **Image 2** (red kundan rakhi) = `budget-100-200.webp`
- **Image 1** (purple designer rakhi) = `budget-above-300.webp`

After saving the images, run:
```bash
python3 build.py
```

Then open `dist/index.html` in your browser to see the new budget section with images!
