/* --------------------------------------------- */
/* --------------- IMAGE UPLOAD ---------------- */
/* --------------------------------------------- */

// Function to initialize the image ponds
function initImagePonds() {
  // Register the size and type validation plugins
  FilePond.registerPlugin(FilePondPluginFileValidateSize);
  FilePond.registerPlugin(FilePondPluginFileValidateType);

  // Get elems with class filepond
  const filePonds = document.querySelectorAll(".filepond");
  filePonds.forEach(setUpImagePond);
}

// Add an image to a quiz
async function addImageToQuiz(quizId, compressedImage) {
  // Get quiz element and data
  const quizEl = document.getElementById(`quiz-${quizId}`);
  const quiz = test.quizzes.find((quiz) => quiz.id === quizId);

  // Change the file name depending on test and quiz id
  const newFileName = `${quizId}.${compressedImage.name.split(".").pop()}`;

  // Append modified file to form field
  const formData = new FormData();
  formData.append("file", compressedImage);
  formData.append("newFileName", newFileName);

  // Send a POST request to the API
  const response = await fetch("/api/tests/addimg", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  } else {
    // Wait for the API response
    const responseData = await response.json();
    const imageUrl = responseData.imageUrl;
    const imageModal = document.getElementById("imageModal");
    const modalImage = document.getElementById("modalImage");

    // Load the image into the quiz HTML by adding the URL to the image src
    var gcsImage = quizEl.querySelector(".gcs-image");
    gcsImage.src = imageUrl + "?v=" + Date.now();
    gcsImage.id = `gcs-image-${quiz.id}`;
    gcsImage.alt = `gcs-image-${quiz.id}`;
    gcsImage.classList.remove("is-hidden");
    gcsImage.addEventListener('click', () => {
      imageModal.classList.add('is-active');
      modalImage.src = imageUrl + "?v=" + Date.now();
    });

    // Update the image URL directly on the quiz object
    quiz.image_url = imageUrl;

    // Mark as changed - update both global and module state
    if (!changedQuizzesIds.includes(quizId)) {
      changedQuizzesIds.push(quizId);
    }
    // Also update the TestEditor module state if available
    if (typeof TestEditor !== 'undefined' && TestEditor.getState) {
      const state = TestEditor.getState();
      if (state && state.changedQuizzesIds && !state.changedQuizzesIds.includes(quizId)) {
        state.changedQuizzesIds.push(quizId);
      }
    }

    // Mark quiz link as edited
    const quizLink = document.getElementById("quiz-link-" + quizId);
    quizLink.classList.add("selected");

    // Enable save buttons
    saveButtons.forEach((saveButton) => {
      saveButton.disabled = false;
    });
  }
}

// Delete an image from a quiz
function deleteImageFromQuiz(quizId) {
  // Get quiz element
  const quizEl = document.getElementById(`quiz-${quizId}`);
  var quiz = test.quizzes.find((quiz) => quiz.id === quizId);

  // Load the image into the quiz HTML by adding the URL to the image src
  var gcsImage = quizEl.querySelector(".gcs-image");
  gcsImage.src = "";
  gcsImage.classList.add("is-hidden");

  // Update the image URL directly on the quiz object
  quiz.image_url = "";

  //  Mark as changed - update both global and module state
  if (!changedQuizzesIds.includes(quizId)) {
    changedQuizzesIds.push(quizId);
  }
  // Also update the TestEditor module state if available
  if (typeof TestEditor !== 'undefined' && TestEditor.getState) {
    const state = TestEditor.getState();
    if (state && state.changedQuizzesIds && !state.changedQuizzesIds.includes(quizId)) {
      state.changedQuizzesIds.push(quizId);
    }
  }

  // Mark quiz link as edited
  const quizLink = document.getElementById("quiz-link-" + quizId);
  quizLink.classList.add("selected");

  // Enable save buttons
  saveButtons.forEach((saveButton) => {
    saveButton.disabled = false;
  });
}

/* ---------------------------------------------- */
/* --------------- IMAGE PASTING ---------------- */
/* ---------------------------------------------- */

// Function to add hover event for image pond instances
function addHoverEventToImagePonds() {
  imagePonds.forEach((imagePond) => {
    imagePond.element.addEventListener("mouseover", () => {
      hoveredPond = imagePond;
    });
    imagePond.element.addEventListener("mouseleave", () => {
      hoveredPond = null;
    });
  });
}

// Function to add paste event listener
function addPasteEvent() {
  document.addEventListener("paste", async (event) => {
    if (!hoveredPond) {
      return;
    }
    var items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const imageBlob = await item.getAsFile();
        hoveredPond.addFile(imageBlob);
        break;
      }
    }
  });
}

/* ----------------------------------------------- */
/* --------------- SETUP FILEPOND ---------------- */
/* ----------------------------------------------- */

function setUpImagePond(imagePondEl) {
  const quizId = imagePondEl.id.split("-").slice(3).join("-");
  const quiz = test.quizzes.find((quiz) => quiz.id === quizId);

  // Texts depending on the language
  const labelIdle = `
    <em lang="en">Paste, drag & drop or <span class="filepond--label-action">browse</span> an image</em>
    <em lang="es">Pega, arrastra y suelta o <span class="filepond--label-action">busca</span> una imagen</em>
  `;
  const labelMaxFileSize = `Maximum file size is 2MB`;
  const labelMaxFileSizeExceeded = `File is too large`;
  const labelFileTypeNotAllowed = `Please select an image file (png, jpg, gif, bmp, webp, svg)`;

  // Create the image pond
  const imagePond = FilePond.create(imagePondEl, {
    // General options
    allowMultiple: false,
    allowReplace: true,
    allowPaste: false,
    // Styling options
    credits: false,
    labelIdle: labelIdle,
    // File size validation
    allowFileSizeValidation: true,
    maxFileSize: "5MB",
    labelMaxFileSizeExceeded: labelMaxFileSizeExceeded,
    labelMaxFileSize: labelMaxFileSize,
    // File type validation
    allowFileTypeValidation: true,
    acceptedFileTypes: [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/bmp",
      "image/webp",
      "image/svg+xml",
    ],
    labelFileTypeNotAllowed: labelFileTypeNotAllowed,
  });

  // Add a placeholder image in case quiz.image_url exists
  if (quiz && quiz.image_url) {
    // Keep text in quiz.image_url after last /
    const fileName = quiz.image_url.split("/").pop();
    imagePond.addFile(new File([], fileName, { type: "image/png" }));
  }

  // Create the event listeners
  imagePond.setOptions({
    onaddfile: async (error, file) => {
      if (!error) {
        // Image object received by FilePond
        let imageObject = file.file;

        // If size is 0 ignore
        if (imageObject.size === 0) {
          return;
        }

        // Skip compression for GIF images
        if (
          imageObject.type === "image/gif" ||
          imageObject.type === "image/svg+xml"
        ) {
          console.log("GIF or SVG image detected. Skipping compression.");
        } else {
          // Compress the image
          try {
            const options = {
              maxSizeMB: 1, // Aim for under 1MB
              maxWidthOrHeight: 2000, // Maximum width or height
              useWebWorker: true, // Improves performance on modern browsers
            };
            imageObject = await imageCompression(imageObject, options);
          } catch (error) {
            console.error("Compression error:", error);
          }
        }

        // Add the image to the quiz
        addImageToQuiz(quizId, imageObject);
      }
    },
    onremovefile: (error, file) => {
      if (!error) {
        // Delete the image from the quiz
        deleteImageFromQuiz(quizId);
      }
    },
  });
  imagePonds.push(imagePond);
  imagePondEl.classList.remove("is-hidden");
}

// Function to add all image events
// console.log("Defining addImageEvents...");
function addImageEvents() {
  initImagePonds();
  addHoverEventToImagePonds();
  addPasteEvent();
}

// Set isAddImageJSLoaded to true
isAddImageJSLoaded = true;
