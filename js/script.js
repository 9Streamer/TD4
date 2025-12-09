// Lazy loading des images
document.addEventListener('DOMContentLoaded', () => {
  const imgs = document.querySelectorAll('.card img, .image-wrapper img');
  imgs.forEach(img => {
    if (img.complete) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('loaded'));
    }
  });
});