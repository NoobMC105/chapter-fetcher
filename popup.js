// popup.js (v2.1 - Handles clipboard writing for fetched content)

document.addEventListener('DOMContentLoaded', function () {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const showApiKeyButton = document.getElementById('showApiKey');
    const apiKeyStatusDiv = document.getElementById('apiKeyStatus');
    
    const fetchChapterPopupButton = document.getElementById('fetchChapterPopup');
    const chapterDisplayArea = document.getElementById('chapterDisplay');
    const copyChapterPopupButton = document.getElementById('copyChapterPopup');
    const popupActionStatusDiv = document.getElementById('popupActionStatus');

    // Load saved API key
    chrome.storage.local.get(['openrouterApiKey'], function (result) {
        if (chrome.runtime.lastError) {
            console.error("Popup: Error loading API key:", chrome.runtime.lastError.message);
            updateApiKeyStatus("Error loading API key.", "error", false);
            return;
        }
        if (result.openrouterApiKey) {
            apiKeyInput.value = result.openrouterApiKey;
            updateApiKeyStatus('API Key is set (hidden).', 'success', false); // Don't auto-hide on load
        } else {
            updateApiKeyStatus('API Key not set. Please save your key.', 'error', false);
        }
    });

    saveApiKeyButton.addEventListener('click', function () {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey) {
            chrome.storage.local.set({ openrouterApiKey: apiKey }, function () {
                if (chrome.runtime.lastError) {
                    console.error("Popup: Error saving API key:", chrome.runtime.lastError.message);
                    updateApiKeyStatus("Error saving API key.", "error");
                    return;
                }
                updateApiKeyStatus('API Key saved successfully!', 'success');
                if (apiKeyInput.type === "text") { // Hide after saving if it was shown
                    apiKeyInput.type = "password";
                    showApiKeyButton.textContent = "Show";
                }
            });
        } else {
            updateApiKeyStatus('API Key cannot be empty.', 'error');
        }
    });

    showApiKeyButton.addEventListener('click', function() {
        if (apiKeyInput.type === "password") {
            apiKeyInput.type = "text";
            showApiKeyButton.textContent = "Hide";
        } else {
            apiKeyInput.type = "password";
            showApiKeyButton.textContent = "Show";
        }
    });

    fetchChapterPopupButton.addEventListener('click', function () {
        updatePopupActionStatus('Requesting chapter from current tab...', 'info');
        chapterDisplayArea.value = ''; 

        chrome.storage.local.get(['openrouterApiKey'], function (storageResult) {
            if (chrome.runtime.lastError) {
                updatePopupActionStatus("Error fetching API key for operation.", "error");
                return;
            }
            const apiKey = storageResult.openrouterApiKey;
            if (!apiKey) {
                updatePopupActionStatus('API Key not set. Please save your key.', 'error');
                alert('API Key is not set. Please save it in the extension popup.');
                return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (chrome.runtime.lastError || !tabs || tabs.length === 0 || !tabs[0].id) {
                    updatePopupActionStatus('Cannot access active tab.', 'error');
                    console.error("Popup: Error querying active tab:", chrome.runtime.lastError?.message);
                    return;
                }
                const activeTab = tabs[0];

                if (activeTab.url && activeTab.url.includes("b.faloo.com/") && activeTab.url.endsWith(".html")) {
                    chrome.tabs.sendMessage(
                        activeTab.id,
                        { action: "processChapterForPopup", apiKey: apiKey },
                        function (response) {
                            if (chrome.runtime.lastError) {
                                console.error("Popup: Error receiving response from content script:", chrome.runtime.lastError.message);
                                updatePopupActionStatus(`Error: ${chrome.runtime.lastError.message}. Is Faloo page open & script running correctly?`, 'error');
                                chapterDisplayArea.value = `Error from content script: ${chrome.runtime.lastError.message}`;
                                return;
                            }
                            if (response && response.success) {
                                const fullText = `Title: ${response.title}\n\n${response.content}`;
                                chapterDisplayArea.value = fullText;
                                // Popup now handles copying
                                navigator.clipboard.writeText(fullText)
                                    .then(() => {
                                        updatePopupActionStatus('Chapter fetched & copied to clipboard!', 'success');
                                    })
                                    .catch(err => {
                                        console.error('Popup: Could not copy text after fetch: ', err);
                                        updatePopupActionStatus('Chapter fetched, but failed to copy. Use "Copy Displayed Text" button.', 'error');
                                    });
                            } else {
                                const errorMsg = response?.error || 'Failed to fetch chapter content.';
                                chapterDisplayArea.value = `Error: ${errorMsg}\nTitle: ${response?.title || ''}`;
                                updatePopupActionStatus(`Failed: ${errorMsg}`, 'error');
                            }
                        }
                    );
                } else {
                    updatePopupActionStatus('Not a Faloo chapter page. Please navigate to a chapter.', 'error');
                }
            });
        });
    });

    copyChapterPopupButton.addEventListener('click', function () {
        const textToCopy = chapterDisplayArea.value;
        if (textToCopy && !textToCopy.startsWith("Error:")) { // Don't copy error messages
            navigator.clipboard.writeText(textToCopy)
                .then(() => updatePopupActionStatus('Text copied to clipboard!', 'success'))
                .catch(err => {
                    console.error('Popup: Could not copy text: ', err);
                    updatePopupActionStatus('Failed to copy text.', 'error');
                });
        } else if (textToCopy.startsWith("Error:")) {
            updatePopupActionStatus('Cannot copy an error message.', 'info');
        }
        else {
            updatePopupActionStatus('Nothing to copy.', 'info');
        }
    });

    function updateApiKeyStatus(message, type, autoHide = true) {
        apiKeyStatusDiv.textContent = message;
        apiKeyStatusDiv.className = `status-message ${type}`;
        apiKeyStatusDiv.style.display = 'block';
        if (autoHide) {
            setTimeout(() => { if(apiKeyStatusDiv) apiKeyStatusDiv.style.display = 'none'; }, 3000);
        }
    }
    function updatePopupActionStatus(message, type) {
        popupActionStatusDiv.textContent = message;
        popupActionStatusDiv.className = `status-message ${type}`;
        popupActionStatusDiv.style.display = 'block';
        setTimeout(() => { if(popupActionStatusDiv) popupActionStatusDiv.style.display = 'none'; }, 3000);
    }

    // Listener for direct updates from content script (e.g., if on-page button is used)
    // This allows the popup to reflect changes even if it wasn't the initiator.
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "updatePopupDisplay") {
            // Ensure popup elements are still valid if the popup was closed and reopened
            const currentChapterDisplayArea = document.getElementById('chapterDisplay');
            if (currentChapterDisplayArea) {
                if (request.success) {
                    currentChapterDisplayArea.value = `Title: ${request.title}\n\n${request.content}`;
                } else {
                    currentChapterDisplayArea.value = `Error from content script: ${request.error || 'Unknown error'}\nTitle: ${request.title || ''}`;
                }
            }
        }
        // Keep the channel open for other listeners if any, though not strictly needed here.
        // sendResponse({}); // Or return true if async operations were started by this listener.
        return false; 
    });
});
