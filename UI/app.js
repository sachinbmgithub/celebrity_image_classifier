(() => {
  'use strict';

  const API_URL = 'http://127.0.0.1:5000/classify_image';

  const athletes = {
    jennifer_lawrence: 'Jennifer Lawrence',
    megan_fox: 'Megan Fox',
    natalie_portman: 'Natalie Portman',
    sandra_bulllock: 'Sandra Bullock',
    scarlett_johnson: 'Scarlett Johansson'
  };

  const input = document.querySelector('#image-input');
  const dropZone = document.querySelector('#drop-zone');
  const preview = document.querySelector('#image-preview');
  const previewImage = document.querySelector('#preview-image');
  const clearButton = document.querySelector('#clear-image');
  const classifyButton = document.querySelector('#classify-button');
  const resultState = document.querySelector('#result-state');

  const views = {
    empty: document.querySelector('#empty-result'),
    success: document.querySelector('#success-result'),
    error: document.querySelector('#error-result')
  };

  let imageData = '';

  function showView(name) {
  Object.entries(views).forEach(([key, element]) => {
    if (key === name) {
      element.hidden = false;
      element.style.display = '';
    } else {
      element.hidden = true;
      element.style.display = 'none';
    }
  });

  const stateText = {
    empty: 'Awaiting image',
    loading: 'Analyzing',
    success: 'Complete',
    error: 'Try again'
  };

  resultState.textContent = stateText[name];
}

  function displayFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      imageData = String(reader.result);
      previewImage.src = imageData;
      preview.hidden = false;
      classifyButton.disabled = false;
      showView('empty');
    };

    reader.readAsDataURL(file);
  }

  function clearFile(event) {
    event.preventDefault();
    event.stopPropagation();

    input.value = '';
    imageData = '';
    previewImage.removeAttribute('src');
    preview.hidden = true;
    classifyButton.disabled = true;

    showView('empty');
  }

  function normalizeResponse(payload) {
    const item = Array.isArray(payload) ? payload[0] : payload;

    if (!item || typeof item !== 'object') {
      return null;
    }

    const rawScores =
      item.class_probability ||
      item.probabilities ||
      item.scores ||
      {};

    const scores = Array.isArray(rawScores)
      ? Object.fromEntries(
          rawScores.map((value, index) => [
            Object.keys(athletes)[index] || `Class ${index + 1}`,
            Number(value)
          ])
        )
      : Object.fromEntries(
          Object.entries(rawScores).map(([key, value]) => [
            key,
            Number(value)
          ])
        );

    const label =
      item.class_name ||
      item.class ||
      item.prediction ||
      Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];

    if (!label || !Object.keys(scores).length) {
      return null;
    }

    const maximum = Math.max(...Object.values(scores));
    const scale = maximum <= 1 ? 100 : 1;

    return {
      label,
      scores: Object.fromEntries(
        Object.entries(scores).map(([key, value]) => [
          key,
          Math.max(0, value * scale)
        ])
      )
    };
  }

  function renderResult(result) {
    const scoreEntries = Object.entries(result.scores)
      .sort((a, b) => b[1] - a[1]);

    const winner =
      scoreEntries.find(([name]) => name === result.label)?.[1] ??
      scoreEntries[0][1];

    document.querySelector('#prediction-name').textContent =
      athletes[result.label] ||
      String(result.label).replaceAll('_', ' ');

    document.querySelector('#confidence-value').textContent =
      `${Math.min(100, winner).toFixed(1)}%`;

    document.querySelector('#probability-list').innerHTML = scoreEntries
      .map(([name, score]) => {
        const value = Math.min(100, Math.max(0, score));
        const label = athletes[name] || String(name).replaceAll('_', ' ');

        return `
          <div class="probability-row">
            <label>${label}</label>
            <b>${value.toFixed(1)}%</b>
            <div class="bar">
              <span style="width:${value}%"></span>
            </div>
          </div>
        `;
      })
      .join('');

    showView('success');
  }

  async function classify() {
    if (!imageData) {
      return;
    }

    classifyButton.disabled = true;
    classifyButton.classList.add('loading');
    classifyButton.querySelector('span').textContent = 'Analyzing';

    showView('loading');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: new URLSearchParams({
          image_data: imageData
        })
      });

      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }

      const result = normalizeResponse(await response.json());

      if (!result) {
        throw new Error('No face result');
      }

      renderResult(result);
    } catch (error) {
      console.warn('Classification failed:', error);
      showView('error');
    } finally {
      classifyButton.disabled = !imageData;
      classifyButton.classList.remove('loading');
      classifyButton.querySelector('span').textContent = 'Classify image';
    }
  }

  input.addEventListener('change', () => {
    displayFile(input.files[0]);
  });

  clearButton.addEventListener('click', clearFile);

  classifyButton.addEventListener('click', classify);

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
    });
  });

  dropZone.addEventListener('drop', (event) => {
    displayFile(event.dataTransfer.files[0]);
  });

  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
})();