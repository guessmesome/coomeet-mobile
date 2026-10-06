/* Local media and redirect configuration. anonKey is the public browser key. */
window.COOMEET_CONFIG = {
  redirect: {
    endpoint: 'https://fljznpejgywacrnxlggv.supabase.co/functions/v1/get-redirect-url',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsanpucGVqZ3l3YWNybnhsZ2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwODc3ODcsImV4cCI6MjA4MDY2Mzc4N30.oDc46bCj9ZPdUUUvdDTddY5un3A1_lIFUrs_UfFh6N4',
    landingKey: 'skcoomeetne'
  },
  videos: {
    hook: 'assets/videos/hero-video-1.mp4',
    final: 'assets/videos/preview-0278.mp4',
    karolina: 'assets/videos/preview-0316.mp4',
    hanna: 'assets/videos/preview-0276.mp4',
    helen: 'assets/videos/preview-0277.mp4',
    laura: ''
  },
  posters: {
    hook: 'assets/videos/hero-video-1.webp',
    final: 'assets/videos/preview-0278.webp',
    karolina: 'assets/videos/preview-0316.webp',
    hanna: 'assets/videos/preview-0276.webp',
    helen: 'assets/videos/preview-0277.webp',
    laura: 'assets/figma/laura.webp'
  },
  photos: {
    karolina: 'assets/profiles/karolina.webp',
    hanna: 'assets/profiles/hanna.webp',
    helen: 'assets/profiles/helen.webp',
    laura: 'assets/profiles/laura.webp'
  }
};
