// background.js (v2 - Enhanced Logging)

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchImageAsBase64") {
      let imageUrl = request.imageUrl; // Already a full URL from content.js
      if (!imageUrl) {
        console.error("Background: Missing imageUrl in request.");
        sendResponse({ error: "Missing imageUrl", success: false });
        return true; // Indicates that the response will be sent asynchronously
      }
  
      // Ensure the URL is absolute (though content.js should already do this)
      if (imageUrl.startsWith("//")) {
        console.log("Background: Normalizing protocol-relative URL");
        imageUrl = "https:" + imageUrl;
      }
      console.log("Background: Attempting to fetch image:", imageUrl);
  
      fetch(imageUrl)
        .then(response => {
          console.log(`Background: Fetch response status for ${imageUrl}: ${response.status}`);
          if (!response.ok) {
            // Log more details if possible, like response headers or a snippet of the body if it's an error page
            console.error(`Background: Network response not OK. Status: ${response.status}, Text: ${response.statusText}`);
            // response.text().then(text => console.error("Background: Error response body:", text.substring(0, 500))); // Log some of the error body
            throw new Error(`Network error: ${response.status} ${response.statusText}`);
          }
          return response.blob();
        })
        .then(blob => {
          console.log(`Background: Blob received for ${imageUrl}. Type: ${blob.type}, Size: ${blob.size}`);
          if (blob.size === 0) {
              console.warn(`Background: Blob for ${imageUrl} is empty (size 0). This might indicate an issue with the image source or fetch.`);
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            if (reader.error) {
              console.error(`Background: FileReader error for ${imageUrl} during onloadend:`, reader.error);
              sendResponse({ error: "FileReader error", details: reader.error.toString(), success: false });
            } else {
              console.log(`Background: FileReader successfully read ${imageUrl}. Result length: ${reader.result ? reader.result.length : 'N/A'}`);
              sendResponse({ dataUrl: reader.result, success: true });
            }
          };
          reader.onerror = (errEvent) => { // FileReader.onerror receives an event
            console.error(`Background: FileReader explicit onerror for ${imageUrl}:`, reader.error); // reader.error contains the actual error
            sendResponse({ error: "FileReader onerror triggered", details: reader.error ? reader.error.toString() : "Unknown FileReader error", success: false });
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error(`Background: Catch block error for ${imageUrl}:`, error.message, error.stack);
          sendResponse({ error: "Failed to fetch/process image in background", details: error.message, success: false });
        });
  
      return true; // Crucial for sendResponse to work asynchronously
    }
  });
  
  console.log("Faloo Chapter Helper: Background script v2 (enhanced logging) loaded.");
  