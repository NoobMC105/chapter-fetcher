// content.js (v2.7 - Handles Clipboard Focus Issues)
console.log("!!!!!!!!!! FALOO CHAPTER HELPER CONTENT SCRIPT V2.7 LOADED !!!!!!!!!!");

// --- Configuration ---
const YOUR_SITE_URL = "https://your-site-url.com"; // Optional
const YOUR_SITE_NAME = "Faloo Extension"; // Optional

// --- Element Selectors ---
const TITLE_SELECTOR = "div.c_l_title h1";
const CONTENT_CONTAINER_SELECTOR = "div.noveContent";
const TEXT_CONTENT_IDENTIFIER_CLASS = "readline";
const VIP_IMAGE_AREA_SELECTOR = "div.con_img";
const VIP_IMAGE_DIV_SELECTOR_PREFIX = "div[id^='img_src_cok_']";
const PROBLEMATIC_IMG_SELECTOR = "img[src*='s.faloo.com/adimages/beijing_page.gif']";

// --- Global Variables ---
let actionButton = null;
let notificationElement = null;

// --- Initialization ---
function init() {
    console.log("Faloo Helper: init()");
    const titleElement = document.querySelector(TITLE_SELECTOR);
    const contentElement = document.querySelector(CONTENT_CONTAINER_SELECTOR);

    if (!titleElement || !contentElement) {
        console.log("Faloo Helper: Required elements not found. Exiting.");
        return;
    }
    console.log("Faloo Helper: Title and Content elements found.");

    const isTextChapter = contentElement.classList.contains(TEXT_CONTENT_IDENTIFIER_CLASS);
    const hasVipImageArea = contentElement.querySelector(VIP_IMAGE_AREA_SELECTOR) !== null;
    const isVipChapter = hasVipImageArea && !isTextChapter;

    console.log(`Faloo Helper: isTextChapter=${isTextChapter}, hasVipImageArea=${hasVipImageArea}, isVipChapter=${isVipChapter}`);

    if (isVipChapter) {
        createButton("OCR & Copy Chapter (VIP)", async () => {
            const apiKey = await getApiKeyFromStorage();
            if (apiKey) {
                handleVipChapter(apiKey); // For on-page button, no sendResponseToPopup
            }
        });
    } else if (isTextChapter) {
        createButton("Copy Chapter (Text)", () => handleTextChapter(contentElement)); // For on-page
    } else {
        console.log("Faloo Helper: Chapter type undetermined.");
    }
}

async function getApiKeyFromStorage() {
    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
            console.error("Faloo Helper: chrome.storage.local is not available.");
            showNotification("Error: Extension storage is not accessible.", "error", 5000);
            alert("Critical Error: Extension storage is not accessible.");
            resolve(null);
            return;
        }
        chrome.storage.local.get(['openrouterApiKey'], function (result) {
            if (chrome.runtime.lastError) {
                console.error("Faloo Helper: Error getting API key from storage:", chrome.runtime.lastError.message);
                showNotification("Error accessing API key storage.", "error", 5000);
                alert("Error accessing API key storage. Please save key in popup.");
                resolve(null);
                return;
            }
            if (result.openrouterApiKey) {
                resolve(result.openrouterApiKey);
            } else {
                showNotification("OpenRouter API Key not set. Please set it in the extension popup.", "error", 5000);
                alert("OpenRouter API Key not set. Please save your API key in the popup.");
                resolve(null);
            }
        });
    });
}

function createButton(text, onClickHandler) {
    console.log("Faloo Helper: createButton - ", text);
    if (actionButton) actionButton.remove();
    actionButton = document.createElement("button");
    actionButton.id = "falooChapterHelperButton";
    actionButton.textContent = text;
    actionButton.addEventListener("click", onClickHandler); // onClickHandler is now potentially async

    const titleElForButton = document.querySelector(TITLE_SELECTOR);
    if (titleElForButton && titleElForButton.parentNode) {
        const wrapper = document.createElement('div');
        wrapper.style.textAlign = 'center';
        wrapper.style.marginBottom = '10px';
        wrapper.appendChild(actionButton);
        titleElForButton.parentNode.insertBefore(wrapper, titleElForButton);
        console.log("Faloo Helper: Button injected.");
    } else {
        // Fallback: append to body if title element is not found as expected
        console.warn("Faloo Helper: Title element for button placement not found. Appending to body.");
        document.body.insertBefore(actionButton, document.body.firstChild);
    }
}

function showNotification(message, type = "info", duration = 3000) {
    console.log(`Faloo Helper: Notification (${type}) - ${message}`);
    if (notificationElement) notificationElement.remove();
    notificationElement = document.createElement("div");
    notificationElement.id = "falooChapterHelperNotification";
    notificationElement.textContent = message;
    notificationElement.classList.add(type);
    document.body.appendChild(notificationElement);
    setTimeout(() => {
        if (notificationElement) notificationElement.remove();
        notificationElement = null;
    }, duration);
}

// Modified to accept an optional sendResponseToPopup callback
async function handleTextChapter(textContentElement, sendResponseToPopup = null) {
    console.log("Faloo Helper: handleTextChapter called. Triggered by popup:", !!sendResponseToPopup);
    showNotification("Processing text chapter...", "info");
    let chapterTitle = "";
    let chapterContent = "";
    try {
        chapterTitle = document.querySelector(TITLE_SELECTOR)?.innerText.trim() || "Untitled";
        chapterContent = textContentElement.innerText.trim();
        
        if (!sendResponseToPopup) { // Only try to copy if NOT triggered by popup
            await navigator.clipboard.writeText(`Title: ${chapterTitle}\n\n${chapterContent}`);
            showNotification("Text chapter copied to clipboard!", "success");
        } else {
            showNotification("Text chapter processed for popup.", "info", 1500); // Shorter notification for popup case
        }

        // If a callback is provided (from popup), send the response
        if (sendResponseToPopup) {
            console.log("Faloo Helper: Sending success response to popup for text chapter.");
            sendResponseToPopup({ success: true, title: chapterTitle, content: chapterContent });
        }
        // Always try to update popup display if it's open (e.g., if on-page button was used)
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "updatePopupDisplay", success: true, title: chapterTitle, content: chapterContent })
                .catch(e => console.log("Faloo Helper: Popup not open or error updating (text success). Error:", e.message));
        }

    } catch (err) {
        console.error("Faloo Helper: Error processing text chapter:", err);
        let specificError = err.message;
        // Check if the error is due to document not being focused
        if (err.name === 'NotAllowedError' && err.message.includes('Document is not focused')) {
            specificError = "Could not copy to clipboard: Page not focused. Try using the popup's copy button or click on the page first.";
        }
        showNotification(`Error: ${specificError}`, "error");
        if (sendResponseToPopup) {
            console.log("Faloo Helper: Sending error response to popup for text chapter.");
            sendResponseToPopup({ success: false, error: specificError, title: chapterTitle });
        }
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "updatePopupDisplay", success: false, error: specificError, title: chapterTitle })
                .catch(e => console.log("Faloo Helper: Popup not open or error updating (text error). Error:", e.message));
        }
    }
}

function extractUrlFromCss(cssUrlString) {
    if (!cssUrlString) return null;
    const match = cssUrlString.match(/url\((['"]?)(.*?)\1\)/);
    let url = match ? match[2] : null;
    if (url && url.startsWith("//")) {
        url = "https:" + url;
    }
    return url;
}

// Modified to accept apiKey and an optional sendResponseToPopup callback
async function handleVipChapter(apiKey, sendResponseToPopup = null) {
    console.log("Faloo Helper: handleVipChapter called. Triggered by popup:", !!sendResponseToPopup);
    if (!apiKey) {
        const msg = "API Key not available for VIP chapter. Please save it in the extension popup.";
        showNotification(msg, "error", 5000);
        alert(msg); // Also alert for on-page button scenario
        if (sendResponseToPopup) sendResponseToPopup({ success: false, error: msg });
        // Ensure button is re-enabled if it exists
        if (actionButton) {
            actionButton.disabled = false;
            actionButton.textContent = "OCR & Copy Chapter (VIP)";
        }
        return;
    }

    showNotification("Processing VIP chapter: Pre-fetching images...", "info", 20000);
    if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = "Fetching Images...";
    }

    const imageContainerToCapture = document.querySelector(VIP_IMAGE_AREA_SELECTOR);
    let chapterTitle = document.querySelector(TITLE_SELECTOR)?.innerText.trim() || "Untitled VIP Chapter"; // Get title early
    let ocrTextContent = ""; // To store final OCR text

    if (!imageContainerToCapture) {
        const msg = "VIP image container area not found.";
        showNotification(msg, "error");
        if (actionButton) { actionButton.disabled = false; actionButton.textContent = "OCR & Copy Chapter (VIP)";}
        if (sendResponseToPopup) sendResponseToPopup({ success: false, error: msg, title: chapterTitle });
        return;
    }

    const imageDivs = imageContainerToCapture.querySelectorAll(VIP_IMAGE_DIV_SELECTOR_PREFIX);
    console.log(`Faloo Helper: Found ${imageDivs.length} VIP image divs to process.`);
    if (imageDivs.length === 0) {
        const msg = "No individual VIP image divs found.";
        showNotification(msg, "error");
        if (actionButton) { actionButton.disabled = false; actionButton.textContent = "OCR & Copy Chapter (VIP)";}
        if (sendResponseToPopup) sendResponseToPopup({ success: false, error: msg, title: chapterTitle });
        return;
    }

    const originalStyles = new Map();
    const removedProblematicImgs = [];

    try {
        let imagesProcessedCount = 0;
        for (const div of imageDivs) {
            const originalBackgroundImage = div.style.backgroundImage;
            const imageUrl = extractUrlFromCss(originalBackgroundImage);
            if (imageUrl) {
                originalStyles.set(div, { backgroundImage: originalBackgroundImage });
                 if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
                    throw new Error("Extension API (chrome.runtime.sendMessage) not available for image fetch.");
                }
                const response = await chrome.runtime.sendMessage({ action: "fetchImageAsBase64", imageUrl: imageUrl });
                if (response && response.success && response.dataUrl) {
                    div.style.backgroundImage = `url("${response.dataUrl}")`;
                    imagesProcessedCount++;
                    showNotification(`Workspaceing images: ${imagesProcessedCount}/${imageDivs.length}`, "info", 2000);
                } else { console.error(`Faloo Helper: Failed to get dataUrl for ${imageUrl}. BG error: ${response?.error}`); }
            }
        }
        
        const imgsToRemove = imageContainerToCapture.querySelectorAll(PROBLEMATIC_IMG_SELECTOR);
        imgsToRemove.forEach(img => {
            const parent = img.parentNode; const nextSibling = img.nextSibling;
            if (parent) { parent.removeChild(img); removedProblematicImgs.push({ node: img, parent: parent, nextSibling: nextSibling });}
        });

        if (typeof domtoimage === 'undefined') { throw new Error("dom-to-image library not loaded."); }
        const domToImageOptions = { quality: 0.95, bgcolor: '#ffffff', skipFonts: true };
        const dataUrl = await domtoimage.toPng(imageContainerToCapture, domToImageOptions);

        if (!dataUrl || dataUrl === "data:,") {
            throw new Error("domtoimage.toPng failed to produce a valid image.");
        }

        const payload = {
            model: "google/gemini-2.5-flash-preview",
            messages: [{
                role: "user",
                content: [{ type: "text", text: "Extract all text content from this image. Present it as a continuous block of text, maintaining original paragraph breaks if discernible. Do not summarize, interpret, or add any commentary. Only provide the extracted text." },
                          { type: "image_url", image_url: { url: dataUrl } }]
            }]
        };
        
        const ocrResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": YOUR_SITE_URL, "X-Title": YOUR_SITE_NAME },
            body: JSON.stringify(payload)
        });

        if (!ocrResponse.ok) {
            const errorData = await ocrResponse.json().catch(() => ({ message: ocrResponse.statusText }));
            throw new Error(`OCR API Error: ${errorData.error?.message || ocrResponse.statusText}`);
        }
        const result = await ocrResponse.json();
        
        if (result.choices?.[0]?.message?.content) {
            if (typeof result.choices[0].message.content === 'string') {
                ocrTextContent = result.choices[0].message.content.trim();
            } else if (Array.isArray(result.choices[0].message.content)) { // For models that might return content as an array
                const textPart = result.choices[0].message.content.find(part => part.type === 'text');
                if (textPart?.text) ocrTextContent = textPart.text.trim();
            }
        }

        if (!ocrTextContent) throw new Error("OCR returned no text or unexpected structure.");

        // Only copy to clipboard if NOT triggered by popup
        if (!sendResponseToPopup) {
            await navigator.clipboard.writeText(`Title: ${chapterTitle}\n\n${ocrTextContent}`);
            showNotification("VIP Chapter OCR'd and copied to clipboard!", "success");
        } else {
            showNotification("VIP chapter processed for popup.", "info", 1500);
        }
        
        if (sendResponseToPopup) {
            console.log("Faloo Helper: Sending success response to popup for VIP chapter.");
            sendResponseToPopup({ success: true, title: chapterTitle, content: ocrTextContent });
        }
        // Always try to update popup display if it's open
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "updatePopupDisplay", success: true, title: chapterTitle, content: ocrTextContent })
                .catch(e => console.log("Faloo Helper: Popup not open or error updating (VIP success). Error:", e.message));
        }

    } catch (err) {
        console.error("Faloo Helper: Error in handleVipChapter:", err.message, err.stack);
        let specificError = err.message;
        if (err.name === 'NotAllowedError' && err.message.includes('Document is not focused')) {
            specificError = "Could not copy to clipboard: Page not focused. Try using the popup's copy button or click on the page first.";
        }
        showNotification(`VIP Processing Error: ${specificError}`, "error", 7000);
        if (sendResponseToPopup) {
            console.log("Faloo Helper: Sending error response to popup for VIP chapter.");
            sendResponseToPopup({ success: false, error: specificError, title: chapterTitle });
        }
        if (chrome.runtime && chrome.runtime.sendMessage) {
             chrome.runtime.sendMessage({ action: "updatePopupDisplay", success: false, error: specificError, title: chapterTitle })
                .catch(e => console.log("Faloo Helper: Popup not open or error updating (VIP error). Error:", e.message));
        }
    } finally {
        // Restore original styles for background images
        originalStyles.forEach((styleProps, element) => {
            element.style.backgroundImage = styleProps.backgroundImage;
        });
        // Re-insert removed problematic <img> tags
        removedProblematicImgs.forEach(item => {
            if (item.nextSibling) {
                item.parent.insertBefore(item.node, item.nextSibling);
            } else {
                item.parent.appendChild(item.node);
            }
        });
        if (actionButton) {
            actionButton.disabled = false;
            actionButton.textContent = "OCR & Copy Chapter (VIP)";
        }
        console.log("Faloo Helper: VIP chapter processing finished, styles and elements restored.");
    }
}

// --- Message Listener for Popup Requests ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "processChapterForPopup") {
        console.log("Faloo Helper: Received 'processChapterForPopup' request from popup. API Key present:", !!request.apiKey);
        const apiKey = request.apiKey; // API key is now sent from popup
        if (!apiKey) {
            console.error("Faloo Helper: API Key missing in request from popup.");
            sendResponse({ success: false, error: "API Key not provided by popup." });
            return true; 
        }

        const contentElement = document.querySelector(CONTENT_CONTAINER_SELECTOR);
        if (!contentElement) {
            console.error("Faloo Helper: Main content element not found on page for popup request.");
            sendResponse({ success: false, error: "Main content element not found on page." });
            return true; 
        }

        const isTextChapter = contentElement.classList.contains(TEXT_CONTENT_IDENTIFIER_CLASS);
        const hasVipImageArea = contentElement.querySelector(VIP_IMAGE_AREA_SELECTOR) !== null;
        const isVipChapter = hasVipImageArea && !isTextChapter;

        console.log(`Faloo Helper: For popup request - isTextChapter: ${isTextChapter}, isVipChapter: ${isVipChapter}`);

        if (isVipChapter) {
            // Pass apiKey and the sendResponse function to handleVipChapter
            handleVipChapter(apiKey, sendResponse);
        } else if (isTextChapter) {
            // Pass contentElement and the sendResponse function to handleTextChapter
            handleTextChapter(contentElement, sendResponse);
        } else {
            console.log("Faloo Helper: Chapter type undetermined for popup request.");
            sendResponse({ success: false, error: "Chapter type undetermined on this page." });
        }
        return true; // Crucial for asynchronous sendResponse from the handlers
    }
});


// --- Run ---
if (document.readyState === "loading") {
    console.log("Faloo Helper: DOM not fully loaded, adding DOMContentLoaded listener.");
    document.addEventListener("DOMContentLoaded", init);
} else {
    console.log("Faloo Helper: DOM already loaded or interactive, calling init() directly.");
    init();
}
