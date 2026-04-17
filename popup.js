document.addEventListener("DOMContentLoaded", async () => {
  function showCustomAlert(message) {
    const oldAlert = document.getElementById('my-custom-alert');
    if (oldAlert) oldAlert.remove();

    const alertOverlay = document.createElement('div');
    alertOverlay.id = 'my-custom-alert';
    alertOverlay.className = 'custom-alert';

    const alertBox = document.createElement('div');
    alertBox.className = 'custom-alert-box';
    alertBox.innerHTML = `
      <strong>Alert</strong>
      <p>${message}</p>
    `;

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.addEventListener('click', () => alertOverlay.remove());

    alertBox.appendChild(okButton);
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
  }

  try {
    enableExtensionFeatures();
  } catch (error) {
  
    showCustomAlert("⚠️ Error initializing extension");
  }

  function enableExtensionFeatures() {
    document.querySelectorAll('input, button, form, .tab-button').forEach(el => {
      el.disabled = false;
      el.classList.remove('disabled');
    });
    initializeFeatures();
  }

  async function initializeFeatures() {
    try {
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabs = document.querySelectorAll('.tab');
      
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          tabButtons.forEach(btn => btn.classList.remove('active'));
          tabs.forEach(tab => tab.classList.remove('active'));
          button.classList.add('active');
          document.getElementById(button.dataset.tab)?.classList.add('active');
        });
      });

    
      const settings = [
        'autoLogin', 'autoCaptcha', 'khatianPrint', 'plotPrint', 'rorAutoFill',
        'mutationAutoFill', 'grnAutoClick', 'chatbot', 'disclaimer'
      ];

      settings.forEach(settingId => {
        const checkbox = document.getElementById(settingId);
        if (checkbox) {
          browser.storage.local.get(settingId)
            .then(result => checkbox.checked = result[settingId] || false)
            .catch(error => console.error(`Error loading ${settingId}:`, error));

          checkbox.addEventListener('change', async () => {
            try {
              const isChecked = checkbox.checked;
              await browser.storage.local.set({ [settingId]: isChecked });
              await browser.runtime.sendMessage({ 
                action: "toggleFeature", 
                settingId, 
                isChecked 
              });
            } catch (error) {
            
            }
          });
        }
      });

  
      setupCredentialsSection('save-username', 'txtusername', 'txtpassword', 'saveUsername', ['username', 'password']);


      setupCredentialsSection('save-ror', 'txtName', 'txtFatherName', 'saveRor', ['name', 'fatherName', 'address'], 'txtaddress');

  
      setupCredentialsSection('save-mutation', 'txtFirstname', 'txtLastName', 'saveMutation', 
        ['firstName', 'lastName', 'fatherNameMutation', 'addressMutation', 'mobile'], 
        'txtFatherNameMutation', 'txtaddressMutation', 'txtMobile');

      const grnTableBody = document.querySelector('#grn-table tbody');
      await setupGrnManagement(grnTableBody);

    } catch (error) {
     
      showCustomAlert("⚠️ Error loading extension features");
    }
  }

  
  function setupCredentialsSection(saveButtonId, input1Id, input2Id, action, storageKeys, ...extraInputIds) {
    const saveButton = document.getElementById(saveButtonId);
    if (saveButton) {
      saveButton.addEventListener('click', async () => {
        const values = {
          [storageKeys[0]]: document.getElementById(input1Id).value.trim(),
          [storageKeys[1]]: document.getElementById(input2Id).value.trim()
        };
        extraInputIds.forEach((id, index) => {
          values[storageKeys[index + 2]] = document.getElementById(id)?.value.trim() || '';
        });

   
        if (!values[storageKeys[0]] || !values[storageKeys[1]]) {
          showCustomAlert(`Please fill in required fields for ${action}`);
          return;
        }
        
        try {
          await browser.storage.local.set(values);
          const response = await browser.runtime.sendMessage({ action, ...values });
          showCustomAlert(response.success ? 
            `${action} details saved successfully` : 
            `Failed to save ${action} details: ${response.error || 'Unknown error'}`);
        } catch (error) {
         
          showCustomAlert(`Error saving ${action} details`);
        }
      });

      browser.storage.local.get(storageKeys)
        .then(result => {
          document.getElementById(input1Id).value = result[storageKeys[0]] || '';
          document.getElementById(input2Id).value = result[storageKeys[1]] || '';
          extraInputIds.forEach((id, index) => {
            const element = document.getElementById(id);
            if (element) element.value = result[storageKeys[index + 2]] || '';
          });
        })
        .catch(error => console.error(`Error loading ${action} details:`, error));
    }
  }

  document.getElementById("save-mutation").addEventListener("click", () => {
  const targetValues = {
    lstShareAreaUnit: document.getElementById("areaUnit").value,
    lstMutePurposeCode: document.getElementById("purposeCode").value,
    lstLandCode: document.getElementById("landCode").value
  };

 
  browser.storage.local.set({ targetValues }, () => {
  

 
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      browser.tabs.sendMessage(tabs[0].id, { action: "applyValues", targetValues });
    });
  });
});


browser.storage.local.get("targetValues", (data) => {
  if (data.targetValues) {
    document.getElementById("areaUnit").value = data.targetValues.lstShareAreaUnit || "";
    document.getElementById("purposeCode").value = data.targetValues.lstMutePurposeCode || "";
    document.getElementById("landCode").value = data.targetValues.lstLandCode || "";
  }
});




  async function setupGrnManagement() {
    const grnTableBody = document.querySelector('#grn-table tbody');
    const form = document.getElementById('grn-form');
    const checkAllBtn = document.getElementById('check-all-btn');
    const downloadAllBtn = document.getElementById('download-all-btn');
    const clearAllBtn = document.getElementById('clear-all');
    const statusLog = document.getElementById('status-log');
    const statusText = document.getElementById('status-text');
    const entryCount = document.getElementById('entry-count');

    const logStatus = (text) => {
      if (statusLog) {
        statusLog.style.display = 'block';
        if (statusText) statusText.textContent = text;
      }
    };

    const hideStatus = () => {
      if (statusLog) statusLog.style.display = 'none';
      if (statusText) statusText.textContent = '';
    };

    const renderGRNTable = (list) => {
      if (!grnTableBody) return;
      const total = list?.length || 0;
      if (entryCount) entryCount.textContent = `${total} entr${total === 1 ? 'y' : 'ies'}`;

      if (!list || list.length === 0) {
        grnTableBody.innerHTML = `<tr class="no-data"><td colspan="6">
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No GRN entries yet</p>
                <span>Add your first entry above</span>
            </div>
        </td></tr>`;
        return;
      }

      grnTableBody.innerHTML = list.map((item, i) => `
        <tr class="animate-in" style="animation-delay:${i * 0.03}s">
            <td>${i + 1}</td>
            <td><code>${item.grn}</code></td>
            <td><code>${item.ror}</code></td>
            <td id="status-${i}" style="text-align:center;"><span style="color:#64748b;">—</span></td>
            <td id="dl-${i}" style="text-align:center;"><button class="btn-icon dl-btn" data-grn="${item.grn}" data-ror="${item.ror}" data-index="${i}" title="Download ROR" style="color:#10b981;"><i class="fas fa-download"></i></button></td>
            <td style="text-align:center;">
              <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
                <button class="btn-icon check-btn" data-grn="${item.grn}" data-ror="${item.ror}" data-index="${i}" title="Check Status" style="color:#818cf8;"><i class="fas fa-search"></i></button>
                <button class="btn-icon delete-btn" data-index="${i}" title="Delete"><i class="fas fa-trash-alt"></i></button>
              </div>
            </td>
        </tr>`).join('');

      grnTableBody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const index = parseInt(btn.dataset.index, 10);
          try {
            const response = await browser.runtime.sendMessage({ action: 'deleteGrnRorEntry', index });
            if (response?.success) {
              renderGRNTable(response.grnRorList);
              showCustomAlert('Entry deleted.');
            } else {
              showCustomAlert('Failed to delete entry');
            }
          } catch (error) {
            showCustomAlert('Error deleting entry');
          }
        });
      });

      grnTableBody.querySelectorAll('.check-btn').forEach(btn => {
        btn.addEventListener('click', () => checkSingleStatus(btn.dataset.grn, btn.dataset.ror, btn.dataset.index));
      });

      grnTableBody.querySelectorAll('.dl-btn').forEach(btn => {
        btn.addEventListener('click', () => downloadSingleRor(btn.dataset.grn, btn.dataset.ror, btn.dataset.index));
      });
    };

    const loadGrnRorList = async () => {
      try {
        const response = await browser.runtime.sendMessage({ action: 'getGrnRorList' });
        if (response?.success) renderGRNTable(response.grnRorList || []);
      } catch (error) {
        console.error('Error loading GRN list:', error);
      }
    };

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const grn = document.getElementById('grn-input')?.value.trim();
      const ror = document.getElementById('ror-input')?.value.trim();
      if (!grn || !ror) {
        showCustomAlert('Please enter both GRN and ROR values');
        return;
      }

      try {
        const response = await browser.runtime.sendMessage({ action: 'saveGrnRorList', grn, ror });
        if (response?.success) {
          document.getElementById('grn-input').value = '';
          document.getElementById('ror-input').value = '';
          renderGRNTable(response.grnRorList || []);
          showCustomAlert('Entry added!');
          hideStatus();
        } else {
          showCustomAlert('Failed to save entry');
        }
      } catch (error) {
        showCustomAlert('Error saving entry');
      }
    });

    clearAllBtn?.addEventListener('click', async () => {
      if (!confirm('Delete all GRN entries?')) return;
      try {
        await browser.storage.local.set({ grnRorList: [] });
        renderGRNTable([]);
        hideStatus();
        showCustomAlert('All entries cleared.', 'info');
      } catch (error) {
        showCustomAlert('Error clearing entries');
      }
    });

    checkAllBtn?.addEventListener('click', async () => checkAllStatus());
    downloadAllBtn?.addEventListener('click', async () => downloadAllRor());

    const checkSingleStatus = async (grn, ror, index) => {
      const el = document.getElementById(`status-${index}`);
      if (el) el.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i></span>';
      logStatus(`Checking ${ror}...`);

      try {
        const response = await browser.runtime.sendMessage({ action: 'checkGrnStatus', grn, ror });
        if (response?.success) {
          if (response.valid) {
            if (el) el.innerHTML = '<span style="color:#10b981;font-weight:600;">✅ Ready</span>';
          } else {
            if (el) el.innerHTML = '<span style="color:#ef4444;">❌ Invalid</span>';
          }
        } else {
          if (el) el.innerHTML = `<span style="color:#f59e0b;" title="${response?.error || ''}">⚠️ Error</span>`;
          logStatus(`Error: ${response?.error || 'Unknown error'}`);
        }
      } catch (error) {
        if (el) el.innerHTML = '<span style="color:#f59e0b;">⚠️ Error</span>';
        logStatus('Error checking status');
      }
    };

    const checkAllStatus = async () => {
      if (checkAllBtn) {
        checkAllBtn.disabled = true;
        checkAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
      }
      logStatus('Loading entries...');

      try {
        const response = await browser.runtime.sendMessage({ action: 'getGrnRorList' });
        const list = response?.grnRorList || [];
        if (!list.length) {
          logStatus('No entries to check.');
          return;
        }

        let validCount = 0;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          logStatus(`Checking ${i + 1}/${list.length}: ${item.grn}...`);
          const el = document.getElementById(`status-${i}`);
          if (el) el.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i></span>';

          const response = await browser.runtime.sendMessage({ action: 'checkGrnStatus', grn: item.grn, ror: item.ror });
          if (response?.success && response.valid) {
            if (el) el.innerHTML = '<span style="color:#10b981;font-weight:600;">✅ Ready</span>';
            validCount++;
          } else if (response?.success && !response.valid) {
            if (el) el.innerHTML = '<span style="color:#ef4444;">❌ Invalid</span>';
          } else {
            if (el) el.innerHTML = '<span style="color:#f59e0b;">⚠️ Error</span>';
          }

          if (i < list.length - 1) await new Promise(r => setTimeout(r, 1000));
        }

        logStatus(`Done! ${validCount}/${list.length} ready to download.`);
      } catch (error) {
        logStatus('Error checking entries');
      } finally {
        if (checkAllBtn) {
          checkAllBtn.disabled = false;
          checkAllBtn.innerHTML = '<i class="fas fa-search"></i> Check All Status';
        }
      }
    };

    const downloadSingleRor = async (grn, ror, index) => {
      const el = document.getElementById(`dl-${index}`);
      if (el) el.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i></span>';
      logStatus(`Downloading ROR for ${ror}...`);

      try {
        const response = await browser.runtime.sendMessage({ action: 'downloadRor', grn, ror });
        if (response?.success) {
          if (el) el.innerHTML = '<span style="color:#10b981;font-weight:600;">✅ Saved</span>';
          logStatus(`✅ Downloaded: ${response.filename || ror}`);
          showCustomAlert(`Downloaded ${response.filename || ror}`);
        } else {
          if (el) el.innerHTML = `<span style="color:#ef4444;" title="${response?.error || ''}">❌ Failed</span>`;
          logStatus(`❌ Failed: ${response?.error || 'Unknown error'}`);
          showCustomAlert(`Download failed: ${response?.error || 'Unknown'}`);
        }
      } catch (error) {
        if (el) el.innerHTML = '<span style="color:#ef4444;">❌ Failed</span>';
        logStatus('Error downloading ROR');
        showCustomAlert('Error downloading ROR');
      }
    };

    const downloadAllRor = async () => {
      if (downloadAllBtn) {
        downloadAllBtn.disabled = true;
        downloadAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
      }

      try {
        const response = await browser.runtime.sendMessage({ action: 'getGrnRorList' });
        const list = response?.grnRorList || [];
        if (!list.length) {
          logStatus('No entries to download.');
          return;
        }

        let downloaded = 0;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          logStatus(`Downloading ${i + 1}/${list.length}: ${item.ror}...`);
          const el = document.getElementById(`dl-${i}`);
          if (el) el.innerHTML = '<span style="color:#f59e0b;"><i class="fas fa-spinner fa-spin"></i></span>';

          const response = await browser.runtime.sendMessage({ action: 'downloadRor', grn: item.grn, ror: item.ror });
          if (response?.success) {
            if (el) el.innerHTML = '<span style="color:#10b981;font-weight:600;">✅</span>';
            downloaded++;
          } else {
            if (el) el.innerHTML = '<span style="color:#ef4444;">❌</span>';
          }

          if (i < list.length - 1) await new Promise(r => setTimeout(r, 4000));
        }

        logStatus(`Done! ${downloaded}/${list.length} ROR files downloaded.`);
        showCustomAlert(`Downloaded ${downloaded}/${list.length} files`);
      } catch (error) {
        logStatus('Error downloading entries');
      } finally {
        if (downloadAllBtn) {
          downloadAllBtn.disabled = false;
          downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Download All ROR';
        }
      }
    };

    await loadGrnRorList();
  }
});