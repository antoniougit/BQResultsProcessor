      document
        .getElementById('processButton')
        .addEventListener('click', mapVariants);

      async function mapVariants() {
        const dataFileInput = document.getElementById('dataFile');
        const xmlCodeInput = document.getElementById('xmlCode');

        if (!dataFileInput.files[0] || !xmlCodeInput.value) {
          alert('Please select a data file and paste the XML code.');
          return;
        }

        const dataFile = dataFileInput.files[0];
        const xmlCode = xmlCodeInput.value;

        try {
          const data = await readDataFile(dataFile);

          const variantMapping = parseXMLCode(xmlCode);

          const mappedData = mapClusterToVariant(data, variantMapping);
          console.log(mappedData);

          const dataFileName = dataFile.name;
          const [fileName, fileExtension] = dataFileName.split('.');

          const finalFileName = `${fileName}-processed.${fileExtension}`;

          downloadFinalReport(mappedData, finalFileName);
        } catch (error) {
          alert('Error processing the data: ' + error.message);
        }
      }

      function readDataFile(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = (event) => {
            const data = event.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const jsonData = XLSX.utils.sheet_to_json(sheet);

            resolve(jsonData);
          };

          reader.onerror = (error) => {
            reject(error);
          };

          reader.readAsBinaryString(file);
        });
      }

      function parseXMLCode(xmlCode) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlCode, 'text/xml');

        const xpathExpression = `//RULE//VALUES[contains(.,'|')] | //RULE/RULE_NAME`;

        const result = xmlDoc.evaluate(
          xpathExpression,
          xmlDoc,
          null,
          XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
          null
        );

        const variantMapping = {};

        let currentVariantName = '';
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);

          if (node.nodeName === 'VALUES') {
            const value = node.textContent.trim();
            const valueParts = value.split('|');

            if (valueParts.length === 2) {
              const start = parseFloat(valueParts[0]);
              const end = parseFloat(valueParts[1]);

              for (let j = start; j <= end; j++) {
                if (!isNaN(j)) {
                  variantMapping[j.toString()] = currentVariantName;
                }
              }
            }
          } else if (node.nodeName === 'RULE_NAME') {
            currentVariantName = node.textContent.trim();
          }
        }

        return variantMapping;
      }

      function mapClusterToVariant(data, variantMapping) {
        const uniqueEvents = {};
        const aggregatedData = {};

        data.forEach((row) => {
          const clusterId = row.CLUSTER_ID.toString();

          if (clusterId in variantMapping) {
            const variantCode = variantMapping[clusterId];
            const userKey = `${row.CAMPAIGN_ID}-${row.DELIVERY_ID}-${row.ENCODED_RECIPIENT_ID}-${variantCode}-${row.EVENT_NAME}`;

            if (!uniqueEvents[userKey]) {
              if (!aggregatedData[variantCode]) {
                aggregatedData[variantCode] = {
                  VARIANT_CODE: variantCode,
                  CAMPAIGN_ID: row.CAMPAIGN_ID,
                  DELIVERY_ID: row.DELIVERY_ID,
                  OPENS: 0,
                  CLICKS: 0,
                  SENDS: 0,
                };
              }

              switch (row.EVENT_NAME) {
                case 'emailOpen':
                  aggregatedData[variantCode].OPENS++;
                  break;
                case 'emailClick':
                  aggregatedData[variantCode].CLICKS++;
                  break;
                case 'emailSend':
                  aggregatedData[variantCode].SENDS++;
                  break;
                default:
                  break;
              }

              uniqueEvents[userKey] = true;
            }
          }
        });

        const sortedAggregatedData = Object.values(aggregatedData).sort(
          (a, b) => {
            const variantA = a.VARIANT_CODE;
            const variantB = b.VARIANT_CODE;

            if (variantA.startsWith('PersadoVariant_C_')) {
              if (variantB.startsWith('PersadoVariant_C_')) {
                return variantA.localeCompare(variantB);
              } else {
                return -1;
              }
            } else if (variantA.startsWith('PersadoVariant_DEF_')) {
              if (variantB.startsWith('PersadoVariant_C_')) {
                return 1;
              } else if (variantB.startsWith('PersadoVariant_DEF_')) {
                return variantA.localeCompare(variantB);
              } else {
                return -1;
              }
            } else {
              if (
                variantB.startsWith('PersadoVariant_C_') ||
                variantB.startsWith('PersadoVariant_DEF_')
              ) {
                return 1;
              } else {
                return variantA.localeCompare(variantB);
              }
            }
          }
        );

        return sortedAggregatedData;
      }

      function downloadFinalReport(data, fileName) {
        const csvData = convertToCSV(data);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });

        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = fileName;
        downloadLink.click();
      }

      function convertToCSV(data) {
        if (data.length === 0) return '';

        const header = Object.keys(data[0]).join(',');
        const rows = data.map((row) => Object.values(row).join(','));
        return [header, ...rows].join('\n');
      }
