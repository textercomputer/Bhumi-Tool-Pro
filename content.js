const intervals = {};

class AutomationManager {
    static async getFromStorage(keys) {
        try {
            return await browser.storage.local.get(keys);
        } catch (error) {
            console.error(`Error getting storage data: ${error}`);
            return {};
        }
    }

    static setIntervalSafe(id, fn, delay) {
        if (intervals[id]) clearInterval(intervals[id]);
        intervals[id] = setInterval(fn, delay);
        return intervals[id];
    }

    static clearIntervalSafe(id) {
        if (intervals[id]) {
            clearInterval(intervals[id]);
            delete intervals[id];
        }
    }
}

const captchaAutomation = {
    copyCaptcha(sourceId, targetId) {
        return () => {
            const source = document.getElementById(sourceId);
            const target = document.getElementById(targetId);
            if (source && target) {
                let value = source.value;
                if (sourceId === 'txtCaptcha') {
                    value = value.replace(/\s+/g, '');
                }
                target.value = value;
            }
        };
    },

    setupCaptchaAutomations() {
        const captchaPairs = [
            ['captchaText', 'drawText1'],
            ['captchaText', 'drawText'],
            ['captchaText', 'txtDrawText'],
            ['captchaText1', 'drawText11'],
            ['captchaText2', 'drawText111'],
            ['captchaText3', 'drawText1111'],
            ['captchaText4', 'drawText11111'],
            ['txtCaptcha', 'txtInput'], 
            ['captaText', 'dText']
        ];

        captchaPairs.forEach(([source, target], index) => {
            AutomationManager.setIntervalSafe(
                `captcha${index}`,
                this.copyCaptcha(source, target),
                1000
            );
        });
    },

    cleanupCaptchaAutomations() {
        Object.keys(intervals).forEach(key => {
            if (key.startsWith('captcha')) {
                AutomationManager.clearIntervalSafe(key);
            }
        });
    }
};


const uiAdjustments = {
    adjustPlotDetails() {
        AutomationManager.setIntervalSafe('plotAdjust', () => {
            const khTd = document.querySelector("#khdetails table tbody tr td");
            const khTable = document.querySelectorAll("#khdetails table")[2];
            const plotDiv = document.querySelectorAll("#plotdetails div")[3];
            
            if (plotDiv?.firstChild) plotDiv.firstChild.classList.remove("tables-fixed");
            if (khTable && khTd) {
                khTd.setAttribute("width", "100%");
                khTable.classList.remove("table-fixed");
            }
        }, 900);
    },

    removeChatbot() {
        AutomationManager.setIntervalSafe('chatbot', () => {
            const parentDiv = document.querySelector('.parent');
            if (parentDiv) parentDiv.remove();
        }, 1900);
    }
};


const loginAutomation = {
    async automateLogin() {
        try {
            const { username, password } = await AutomationManager.getFromStorage(['username', 'password']);
            if (!username || !password) {
                console.log('[BhumiToolPro] No saved credentials, skipping auto-login');
                return;
            }

            const beforeLoginDiv = document.getElementById("beforeLoginDiv");
            if (beforeLoginDiv?.style.display === "none") {
                console.log('[BhumiToolPro] Already logged in');
                return;
            }

            // Click sign-in to reveal the login form
            const signInButton = document.getElementById("signIn");
            if (signInButton) {
                signInButton.click();
                console.log('[BhumiToolPro] Clicked signIn, waiting for login form...');
            }

            // Wait for the username field to appear (15s — page can be slow)
            const usernameField = await this.waitForElement("username", 15000);
            if (!usernameField) {
                console.warn('[BhumiToolPro] Username field not found after 15s, aborting auto-login');
                return;
            }

            const passwordField = document.getElementById("password");
            if (!passwordField) {
                console.warn('[BhumiToolPro] Password field not found, aborting');
                return;
            }

            // Fill credentials
            usernameField.value = username;
            usernameField.dispatchEvent(new Event('input', { bubbles: true }));
            usernameField.dispatchEvent(new Event('change', { bubbles: true }));

            passwordField.value = password;
            passwordField.dispatchEvent(new Event('input', { bubbles: true }));
            passwordField.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('[BhumiToolPro] Credentials filled, solving CAPTCHA...');

            // Trigger CAPTCHA solving
            this.solveLoginCaptcha();

            console.log('[BhumiToolPro] Credentials filled, waiting for CAPTCHA to be solved...');

            // Wait for AI CAPTCHA solver to fill the captcha input
            const captchaResult = await this.waitForCaptchaSolved(30000);
            if (!captchaResult) {
                console.warn('[BhumiToolPro] CAPTCHA not solved in time');
                return;
            }

            console.log('[BhumiToolPro] CAPTCHA solved, clicking OTPGenSubmit...');
            const otpSubmit = document.getElementById("OTPGenSubmit");
            if (otpSubmit) {
                otpSubmit.click();
                console.log('[BhumiToolPro] OTPGenSubmit clicked');
            } else {
                console.error('[BhumiToolPro] OTPGenSubmit button not found');
            }
        } catch (error) {
            console.error('[BhumiToolPro] Login automation error:', error.message);
        }
    },

    async waitForElement(elementId, timeout) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const element = document.getElementById(elementId);
            if (element && element.offsetParent !== null) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Element ${elementId} not found`);
    },

    async waitForCaptchaSolved(timeout) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const captchaInput = document.getElementById('txtCaptcha');
            if (captchaInput && captchaInput.value.trim()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return false;
    },

    async solveLoginCaptcha() {
        const captchaImg = document.getElementById('captchaImage');
        if (!captchaImg) {
            console.warn('[BhumiToolPro] CAPTCHA image not found');
            return;
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = captchaImg.naturalWidth || captchaImg.width;
        canvas.height = captchaImg.naturalHeight || captchaImg.height;
        ctx.drawImage(captchaImg, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        try {
            const response = await browser.runtime.sendMessage({ action: 'solveCaptcha', imageData });
            if (response.success) {
                const captchaInput = document.getElementById('txtCaptcha');
                if (captchaInput) {
                    captchaInput.value = response.text;
                    captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
                    captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log('[BhumiToolPro] CAPTCHA solved and filled');
                }
            } else {
                console.error('[BhumiToolPro] CAPTCHA solve failed:', response.error);
            }
        } catch (e) {
            console.error('[BhumiToolPro] CAPTCHA solve error:', e);
        }
    },

    verifyLogin(retries) {
        if (retries <= 0) {
        
            return;
        }
        setTimeout(() => {
            const afterLoginDiv = document.getElementById("afterLoginDiv");
            if (afterLoginDiv?.style.display !== "none") {
                
            } else {
           
                this.verifyLogin(retries - 1);
            }
        }, 2000);
    }
};

browser.runtime.onMessage.addListener((message) => {
  if (message.action === "applyValues" && message.targetValues) {
    applyValues(message.targetValues);
  }
});

function applyValues(targetValues) {
  const intervalId = setInterval(() => {
    let allSelected = true;

    if (targetValues.lstShareAreaUnit) {
      const areaUnitSelect = document.getElementById("lstShareAreaUnit");
      if (areaUnitSelect) {
        if (Array.from(areaUnitSelect.options).some(opt => opt.value === targetValues.lstShareAreaUnit)) {
          areaUnitSelect.value = targetValues.lstShareAreaUnit;
          areaUnitSelect.dispatchEvent(new Event("change", { bubbles: true }));
        
        } else {
         
          allSelected = false;
        }
      } else {
  
        allSelected = false;
      }
    } else {
    
    }

   
    if (targetValues.lstMutePurposeCode) {
      const purposeSelect = document.getElementById("lstMutePurposeCode");
      if (purposeSelect) {
        if (Array.from(purposeSelect.options).some(opt => opt.value === targetValues.lstMutePurposeCode)) {
          purposeSelect.value = targetValues.lstMutePurposeCode;
          purposeSelect.dispatchEvent(new Event("change", { bubbles: true }));
     
        } else {
          
          allSelected = false;
        }
      } else {
       
        allSelected = false;
      }
    } else {
    
    }

    if (targetValues.lstLandCode) {
      const landCodeSelect = document.getElementById("lstLandCode");
      if (landCodeSelect) {
        if (Array.from(landCodeSelect.options).some(opt => opt.value === targetValues.lstLandCode)) {
          landCodeSelect.value = targetValues.lstLandCode;
          landCodeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        
        } else {
         
          allSelected = false;
        }
      } else {
    
        allSelected = false;
      }
    } else {
   
    }

    if (allSelected || (!targetValues.lstShareAreaUnit && !targetValues.lstMutePurposeCode && !targetValues.lstLandCode)) {
      clearInterval(intervalId);
     
    }
  }, 500);
}

try {
  const tab2Button = document.getElementById("tab2");

  if (tab2Button) {
    tab2Button.addEventListener("click", () => {
    

      setTimeout(() => {
        browser.storage.local.get("targetValues", (data) => {
          if (data && data.targetValues) {
            applyValues(data.targetValues);
          } else {
          
          }
        });
      }, 500);

      setTimeout(() => {
        try {
          const addButton = document.querySelector("#tabContent2 #sellerDtlsAdd");

          if (addButton) {
            if (!addButton.dataset.listenerAttached) {
              addButton.addEventListener("click", () => {
                
                setTimeout(() => {
                  browser.storage.local.get("targetValues", (data) => {
                    if (data && data.targetValues) {
                      applyValues(data.targetValues);
                    } else {
                     
                    }
                  });
                }, 500);
              });
              addButton.dataset.listenerAttached = "true";
          
            } else {
            
            }
          } else {
          
          }
        } catch (error) {
        
        }
      }, 700);
    });
  } else {

  }
} catch (error) {
  
}


try {
  const table = document.querySelector("table");
  if (table) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeName === "TR") {
           
              setTimeout(() => {
                browser.storage.local.get("targetValues", (data) => {
                  if (data && data.targetValues) {
                    applyValues(data.targetValues);
                  }
                });
              }, 500);
            }
          });
        }
      });
    });
    observer.observe(table, { childList: true, subtree: true });
  
  } else {
  
  }
} catch (error) {
  console.error("Error setting up table observer:", error.message);
}

const disclaimerAutomation = {
    closeDisclaimer() {
        AutomationManager.setIntervalSafe('disclaimer', () => {
            const closeButton = document.getElementById('close-popup');
            if (closeButton) {
                closeButton.dispatchEvent(new MouseEvent('click', { 
                    bubbles: true, 
                    cancelable: true, 
                    view: window 
                }));
            }
        }, 1900);
    },

    closeRorDisclaimer() {
        AutomationManager.setIntervalSafe('rorDisclaimer', () => {
            const modal = document.getElementById('myModal');
            if (modal?.style.display === "block") {
                const exitButton = modal.querySelector('button[data-dismiss="modal"]');
                if (exitButton) exitButton.click();
            }
        }, 1000);
    }
};


const grnAutomation = {
    async performAutomation(grnData) {
        for (const [index, { grn, ror }] of grnData.entries()) {
           
            await this.automateStep(grn, ror);
           
        }
       
    },

    async automateStep(grn, ror) {
        try {
            this.fillForm(grn, ror);
            await this.submitAndProcess();
        } catch (error) {
            console.error("Automation step failed:", error);
        }
    },

    fillForm(grn, ror) {
        const requestType = document.getElementById("lstRequestType");
        if (requestType) {
            requestType.value = "RORGrnSearch";
            requestType.dispatchEvent(new Event("change"));
        }

        const grnInput = document.getElementById("txtGRN_NO");
        if (grnInput) {
            grnInput.value = grn;
            grnInput.dispatchEvent(new Event("input"));
        }

        const rorInput = document.getElementById("txtAPPLN_NO");
        if (rorInput) {
            rorInput.value = ror;
            rorInput.dispatchEvent(new Event("input"));
        }
    },

    async submitAndProcess() {
        const submitButton = document.getElementById("btnSubmitGRNNo");
        if (submitButton) {
            submitButton.click();
            await loginAutomation.waitForElement("#popup_content", 5000);
            await this.handlePopup();
        }
    },

    async handlePopup() {
        const popup = document.getElementById("popup_message");
        if (!popup) return;

        const message = popup.textContent.trim();
        if (message.includes("If details shown are correct")) {
            await this.processSuccessFlow();
        } else if (message.includes("Signed Copy Not Yet Generated")) {
            const okButton = document.getElementById("popup_ok");
            if (okButton) {
                okButton.click();
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    },

    async processSuccessFlow() {
        const okButton1 = document.getElementById("popup_ok");
        if (okButton1) {
            okButton1.click();
            await loginAutomation.waitForElement("#btnContinue", 5000);
            const continueButton = document.getElementById("btnContinue");
            if (continueButton) {
                continueButton.click();
                await this.waitForLoading();
                const okButton2 = document.getElementById("popup_ok");
                if (okButton2) {
                    okButton2.click();
                    await this.downloadPDF();
                }
            }
        }
    },

    async waitForLoading() {
        const loading = document.querySelector(".loading");
        if (loading) {
            const start = Date.now();
            while (loading.style.display !== "none" && Date.now() - start < 10000) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    },

    async downloadPDF() {
        await loginAutomation.waitForElement("#btnPDF", 5000);
        const downloadButton = document.getElementById("btnPDF");
        if (downloadButton) {
            downloadButton.click();
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};


const autoFill = {
    async rorFill() {
        const { name, fatherName, address } = await AutomationManager.getFromStorage(["name", "fatherName", "address"]);
        const fields = {
            txtFirstName: name,
            txtGuardianName: fatherName,
            txtAddress1: address
        };
        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) element.value = value;
        });
    },

    async mutationFill() {
        const { firstName, lastName, fatherNameMutation, addressMutation, mobile } = 
            await AutomationManager.getFromStorage(["firstName", "lastName", "fatherNameMutation", "addressMutation", "mobile"]);
        const fields = {
            uni_fname: firstName,
            uni_lname: lastName,
            uni_father: fatherNameMutation,
            uni_ad1: addressMutation,
            txtSellerMobile: mobile
        };
        Object.entries(fields).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element && value) element.value = value;
        });
    }
};


const printManager = {
    createPrintButton(id, label, handler) {
        const viewButton = document.getElementById(id === "khatianPrint" ? "khbutton" : "plbutton");
        if (!viewButton || document.getElementById(`${id}Button`)) return;

        const button = document.createElement('button');
        button.innerHTML = label;
        button.id = `${id}Button`;
        button.style.cssText = 'background-color: #F245AF; color: white; height: 35px; width: 110px; margin-left: 20px; cursor: pointer;';
        button.className = 'form-control btn btn-primary btn-xs';
        button.onclick = handler;
        viewButton.parentNode.insertBefore(button, viewButton.nextSibling);
        return button;
    },

    async printContent(id) {
        const content = await browser.runtime.sendMessage({ 
            action: id === "khatianPrint" ? "printKhatian" : "printPlot" 
        });
        return content?.htmlContent;
    }
};


function toggleFeature(settingId, isChecked) {
    const toggles = {
        autoCaptcha: () => isChecked ? captchaAutomation.setupCaptchaAutomations() : captchaAutomation.cleanupCaptchaAutomations(),
        disclaimer: () => {
            if (isChecked) {
                disclaimerAutomation.closeDisclaimer();
                disclaimerAutomation.closeRorDisclaimer();
            } else {
                AutomationManager.clearIntervalSafe('disclaimer');
                AutomationManager.clearIntervalSafe('rorDisclaimer');
            }
        },
        chatbot: () => isChecked ? uiAdjustments.removeChatbot() : AutomationManager.clearIntervalSafe('chatbot'),
        grnAutoClick: () => isChecked ? AutomationManager.setIntervalSafe('grnAutoClick', grnAutomation.handlePopup, 3000) : AutomationManager.clearIntervalSafe('grnAutoClick'),
        autoLogin: () => isChecked && loginAutomation.automateLogin(),
        rorAutoFill: () => isChecked && autoFill.rorFill(),
        mutationAutoFill: () => {
            if (isChecked) {
                AutomationManager.setIntervalSafe('mutationFill', autoFill.mutationFill, 2000);
            } else {
                AutomationManager.clearIntervalSafe('mutationFill');
            }
        },
        khatianPrint: () => {
            if (isChecked) {
                printManager.createPrintButton('khatianPrint', 'Khatian Print', () => 
                    browser.runtime.sendMessage({ action: "printKhatian" }));
            } else {
                document.getElementById('khatianPrintButton')?.remove();
            }
        },
        plotPrint: () => {
            if (isChecked) {
                printManager.createPrintButton('plotPrint', 'Plot Print', () => 
                    browser.runtime.sendMessage({ action: "printPlot" }));
            } else {
                document.getElementById('plotPrintButton')?.remove();
            }
        }
    };

    toggles[settingId]?.();
}


browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.settingId) {
        toggleFeature(message.settingId, message.isChecked);
    } else if (message.action === "startAutomation") {
        if (message.grnData?.length) {
            grnAutomation.performAutomation(message.grnData);
        }
    } else if (message.action === "printKhatian" || message.action === "printPlot") {
        const id = message.action === "printKhatian" ? "khdetails" : "plotdetails";
        sendResponse({ htmlContent: generatePrintHTML(id) });
    } else if (message.action === "injectContent") {
        const parsed = new DOMParser().parseFromString(message.html, "text/html");
        document.replaceChild(parsed.documentElement, document.documentElement);
        setTimeout(() => {
            window.print();
            setTimeout(() => browser.runtime.sendMessage({ action: "closeTab" }), 1000);
        }, 50);
    }
});

function generatePrintHTML(id) {
  const style = `
    @media print {
      @page { size: A4; margin: 1cm; }
      body {
        font-family: 'Noto Serif Bengali', 'Bangla Sangam MN', 'Noto Sans Bengali', sans-serif;
        color: black;
        margin: 0;
        padding: 0;
      }
      .print-container {
        border: none;
        padding: 10px;
        box-sizing: border-box;
      }
      .header-image {
        width: 100%;
        height: auto;
        margin-bottom: 10px;
      }
      .title {
        text-align: center;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .meta {
        font-size: 13px;
        margin-bottom: 5px;
      }
      .timestamp-table {
        width: 100%;
        font-size: 13px;
        margin-bottom: 10px;
      }
      .timestamp-table td {
        font-weight: bold;
        color: blue;
        padding-left: 10px;
      }
      table {
        border-collapse: collapse;
        width: 100%;
        font-size: 13px;
        margin-bottom: 10px;
      }
      th, td {
        border: 1px solid black;
        padding: 2px;
        text-align: center;
        white-space: nowrap;
        word-break: break-word;
      }
      .totals {
        font-weight: bold;
        text-align: center;
        font-size: 13px;
        margin-top: 10px;
      }
      .disclaimer {
        font-size: 12px;
        text-align: center;
        border-top: 1px solid black;
        padding-top: 10px;
        margin-top: 20px;
      }
    }
  `;

  const getSelectedText = (id) => {
    const el = document.getElementById(id);
    return el?.options[el.selectedIndex]?.text || 'N/A';
  };

  const districtText = getSelectedText("lstDistrictCode1");
  const blockText = getSelectedText("lstBlockCode1");
  const mouzaText = getSelectedText("lstMouzaList");
  const timestamp = new Date().toLocaleString('en-GB');

  let plotNoValue = 'N/A';
  let contentToPrint = '';

  if (id === 'khdetails') {
    const plotno = document.evaluate('//*[@id="khdetails"]/table/tbody/tr/td[1]/div[2]/table/tbody/tr[1]/th[2]/div/font', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    plotNoValue = plotno ? plotno.textContent.trim() : 'N/A';

    const liveDataContainer = document.querySelector('.table-responsive');
    const liveDataContent = liveDataContainer ? liveDataContainer.outerHTML : 'Live Data Table Unavailable';

    contentToPrint = `
      <div class="print-container">
        <img src="${browser.runtime.getURL('images/header.png')}" class="header-image" />
        <div class="title">খতিয়ান ও দাগের তথ্য</div>
        <div class="meta">জেলা: ${districtText} | ব্লক: ${blockText} | মৌজা: ${mouzaText}</div>
        <table class="timestamp-table">
          <tr><td>(Live Data As On ${timestamp})</td></tr>
        </table>
        ${liveDataContent}
        <div class="disclaimer">
          Disclaimer: Content here mirrors data from banglarbhumi.gov.in. For accuracy, contact BL&LRO
        </div>
      </div>
    `;
  } else if (id === 'plotdetails') {
    const plotno = document.evaluate('//*[@id="plotdetails"]/div[1]/div[2]/table/tbody/tr[2]/td[1]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    plotNoValue = plotno ? plotno.textContent.trim() : 'N/A';

    const liveDataContainer = document.querySelector('.table-responsive');
    const liveDataContent = liveDataContainer ? liveDataContainer.outerHTML : 'Live Data Table Unavailable';

    const dagTableElement = document.querySelector('#plotdetails');
    const dagTableContent = dagTableElement ? dagTableElement.outerHTML : 'DAG Information Table Unavailable';

    const rows = document.querySelectorAll("#plotdetails table tbody tr");
    let totalPortion = 0;
    let totalPortionAmount = 0;
    rows.forEach(row => {
      const portionCell = row.cells[3];
      const amountCell = row.cells[4];
      if (portionCell && amountCell) {
        totalPortion += parseFloat(portionCell.innerText.trim()) || 0;
        totalPortionAmount += parseFloat(amountCell.innerText.trim()) || 0;
      }
    });

    const totalPortionText = `মোট অংশ: ${totalPortion.toFixed(4)}`;
    const totalPortionAmountText = `মোট অংশ পরিমাণ (একর): ${totalPortionAmount.toFixed(4)}`;

    contentToPrint = `
      <div class="print-container">
        <img src="${browser.runtime.getURL('images/header.png')}" class="header-image" />
        <div class="title">খতিয়ান ও দাগের তথ্য</div>
        <div class="meta">জেলা: ${districtText} | ব্লক: ${blockText} | মৌজা: ${mouzaText}</div>
        <table class="timestamp-table">
          <tr><td>(Live Data As On ${timestamp})</td></tr>
        </table>
        ${liveDataContent}
        ${dagTableContent}
        <div class="totals">${totalPortionText} // ${totalPortionAmountText}</div>
        <div class="disclaimer">
          Disclaimer: Content here mirrors data from banglarbhumi.gov.in. For accuracy, contact BL&LRO
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${mouzaText}_${plotNoValue}</title>
      <style>${style}</style>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali&display=swap" rel="stylesheet">
    </head>
    <body>${contentToPrint}</body>
    </html>
  `;
}



(async () => {
    uiAdjustments.adjustPlotDetails();
    const items = await AutomationManager.getFromStorage(null);
    Object.entries(items).forEach(([key, value]) => {
        if (typeof value === 'boolean') toggleFeature(key, value);
    });
})();