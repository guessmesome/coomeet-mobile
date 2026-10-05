# Profile photos

User-supplied JPEGs for the four profile cards on onboarding screen 4.

| Profile | Source filename | Source dimensions | WebP filename | WebP dimensions | Source bytes | WebP bytes |
| --- | --- | --- | --- | --- | ---: | ---: |
| Karolina | `IMG_0308.JPG` | 1024 × 1280 | `karolina.webp` | 700 × 875 | 194126 | 97518 |
| Hanna | `IMG_0304.JPG` | 960 × 1280 | `hanna.webp` | 700 × 933 | 170176 | 193918 |
| Helen | `IMG_0302.JPG` | 1024 × 1280 | `helen.webp` | 700 × 875 | 158793 | 178626 |
| Laura | `IMG_0313.JPG` | 1080 × 1350 | `laura.webp` | 700 × 875 | 183141 | 113196 |

Processing: apply EXIF orientation, resize proportionally to a maximum width of
700 px with Lanczos, then encode with `cwebp -q 92 -m 6`. The images are not
cropped, stretched, or padded; card crops are handled by the page layout.
Downloaded originals remain unchanged.

Total storage: **706236 bytes → 583258 bytes**, a **17.41%** reduction.
