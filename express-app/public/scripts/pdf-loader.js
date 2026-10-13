// Use the maintained ES-module build; the AJAX loader can load this classic script.
window.pdfjsReady = import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.min.mjs').then(module => {
  window.pdfjsLib = module;
  module.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs';
}).catch(error => console.error('PDF renderer could not load:', error));
