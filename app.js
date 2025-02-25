let map,
    userPosition,
    markersCollection,
    currentWeather,
    lastClickCoords = null, // Для хранения координат клика по карте.
    currentRoute = null;    // Для хранения текущего построенного маршрута.

ymaps.ready(initializeApp);

function initializeApp() {
    // Инициализация карты
    map = new ymaps.Map('map', {
        center: CONFIG.DEFAULT_MAP_CENTER,
        zoom: CONFIG.DEFAULT_ZOOM,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl', 'routeButtonControl']
    });

    // Создаем коллекцию маркеров
    markersCollection = new ymaps.GeoObjectCollection();
    map.geoObjects.add(markersCollection);

    // Проверка поддержки API
    checkBrowserSupport();

    // Восстановление последних данных
    restoreLastLocation();
    restoreMarkers();
    renderSavedMarkersList();

    setupEventListeners();
}

// Проверка поддержки HTML5 API
function checkBrowserSupport() {
    const supportDiv = document.getElementById('browserSupport');
    const checks = [
        { name: 'Геолокация', supported: !!navigator.geolocation },
        { name: 'LocalStorage', supported: !!window.localStorage },
        { name: 'Fetch API', supported: !!window.fetch }
    ];

    supportDiv.innerHTML = checks.map(check =>
        `<p>${check.name}: ${check.supported ? '✅ Поддерживается' : '❌ Не поддерживается'}</p>`
    ).join('');
}

// Установка обработчиков событий
function setupEventListeners() {
    document.getElementById('geoButton').addEventListener('click', getCurrentLocation);
    document.getElementById('addMarkerButton').addEventListener('click', openMarkerModal);
    document.getElementById('routeButton').addEventListener('click', handleRouteButton);
    document.getElementById('clearDataButton').addEventListener('click', clearAllData);

    document.getElementById('markerForm').addEventListener('submit', handleMarkerSubmit);
    document.getElementById('cancelMarker').addEventListener('click', closeMarkerModal);

    // Обработчик клика по карте для определения координат при добавлении метки
    map.events.add('click', event => {
        lastClickCoords = event.get('coords');
        openMarkerModal();
    });
}

// Получение текущей геолокации пользователя
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userPosition = [
                    position.coords.latitude,
                    position.coords.longitude
                ];
                saveUserLocation(userPosition);
                map.setCenter(userPosition, 12);
                addUserMarker(userPosition);
                fetchWeatherForLocation(userPosition);
            },
            handleGeolocationError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        alert("Геолокация не поддерживается вашим браузером");
    }
}

// Сохранение геопозиции в localStorage
function saveUserLocation(coords) {
    localStorage.setItem(
        CONFIG.STORAGE_KEYS.USER_LOCATION,
        JSON.stringify({
            coords: coords,
            timestamp: new Date().toISOString()
        })
    );
}

// Восстановление последней геопозиции
function restoreLastLocation() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_LOCATION);
    if (saved) {
        const data = JSON.parse(saved);
        userPosition = data.coords;
        // Если данные не устарели, используем их (в пределах последних 24 часов)
        if (new Date(data.timestamp) > new Date(new Date().getTime() - 24 * 60 * 60 * 1000)) {
            map.setCenter(userPosition, 12);
            addUserMarker(userPosition);
            fetchWeatherForLocation(userPosition);
        }
    }
}

// Добавление маркера текущего местоположения
function addUserMarker(coords) {
    removeUserLocationMarker();
    const userMarker = new ymaps.Placemark(
        coords,
        { balloonContent: 'Ваше местоположение' },
        { preset: 'islands#blueCircleDotIcon' }
    );
    userMarker.properties.set('isUserLocation', true);
    markersCollection.add(userMarker);
}

// Удаление предыдущего маркера геолокации
function removeUserLocationMarker() {
    markersCollection.each(obj => {
        if (obj.properties.get('isUserLocation')) {
            markersCollection.remove(obj);
        }
    });
}

// Получение данных о погоде через API Яндекс.Погоды
async function fetchWeatherForLocation(coords) {
    try {
        const [lat, lon] = coords;
        let response = await axios.get(CONFIG.WEATHER_API_URL, {
            params: {
                lat: lat,
                lon: lon,
                lang: 'ru_RU'
            },
            headers: {
                'X-Yandex-API-Key': CONFIG.API_KEYS.YANDEX_WEATHER
            }
        });
        currentWeather = {
            temperature: response.data.fact.temp,
            description: response.data.fact.condition
        };
        displayWeather(currentWeather);
        return currentWeather;
    } catch (error) {
        console.error('Ошибка получения погоды:', error);
        return null;
    }
}

// Отображение погоды на странице
function displayWeather(weather) {
    const weatherDiv = document.getElementById('currentWeather');
    weatherDiv.innerHTML = `
    🌡️ ${weather.temperature}°C, ${weather.description}
  `;
}

// Открытие модального окна для добавления метки
function openMarkerModal() {
    if (!lastClickCoords && !userPosition) {
        alert("Сначала определите геолокацию или кликните по карте для добавления метки.");
        return;
    }
    document.getElementById('markerModal').style.display = 'block';
}

// Закрытие модального окна
function closeMarkerModal() {
    document.getElementById('markerModal').style.display = 'none';
    lastClickCoords = null;
    document.getElementById('markerForm').reset();
}

// Обработка отправки формы добавления метки
async function handleMarkerSubmit(event) {
    event.preventDefault();
    let coords = lastClickCoords ? lastClickCoords : userPosition;
    if (!coords) return;

    const name = document.getElementById('markerName').value;
    const description = document.getElementById('markerDescription').value;
    const category = document.getElementById('markerCategory').value;
    const timestamp = new Date().toISOString();

    // Получаем данные о погоде для координат метки
    let weather = await fetchWeatherForLocation(coords);

    const markerData = {
        coords: coords,
        name: name,
        description: description,
        category: category,
        timestamp: timestamp,
        weather: weather
    };

    addCustomMarker(markerData);
    saveMarkerToLocalStorage(markerData);
    renderSavedMarkersList();

    closeMarkerModal();
}

// Добавление кастомного маркера на карту с информацией о погоде и ссылкой для построения маршрута
function addCustomMarker(markerData) {
    const { coords, name, description, category, timestamp, weather } = markerData;
    let balloonContentBody = `
    <strong>Описание:</strong> ${description}<br>
    <strong>Категория:</strong> ${category}<br>
    <strong>Создан:</strong> ${new Date(timestamp).toLocaleString()}<br>
    <strong>Погода:</strong> ${weather ? (weather.description + ', ' + weather.temperature + '°C') : 'Нет данных'}<br>
    <a href="#" onclick='createRouteFromMarker(${JSON.stringify(coords)})'>Построить маршрут</a>
  `;

    const customMarker = new ymaps.Placemark(
        coords,
        {
            balloonContentHeader: name,
            balloonContentBody: balloonContentBody,
            hintContent: name
        },
        {
            preset: getCategoryIcon(category)
        }
    );
    markersCollection.add(customMarker);
}

// Функция для глобального вызова построения маршрута из балуна метки
function createRouteFromMarker(markerCoords) {
    if (!userPosition) {
        alert("Сначала получите ваше местоположение");
        return;
    }
    createRoute(userPosition, markerCoords);
    map.balloon.close();
}

// Выбор иконки для метки в зависимости от категории
function getCategoryIcon(category) {
    const icons = {
        restaurant: 'islands#redEatingIcon',
        attraction: 'islands#blueArchitectureIcon',
        park: 'islands#greenParkIcon',
        shop: 'islands#blueFashionIcon',
        default: 'islands#blueCircleDotIcon'
    };
    return icons[category] || icons['default'];
}

// Сохранение данных метки в localStorage
function saveMarkerToLocalStorage(markerData) {
    let savedMarkers = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MARKERS) || '[]');
    savedMarkers.push(markerData);
    localStorage.setItem(CONFIG.STORAGE_KEYS.MARKERS, JSON.stringify(savedMarkers));
}

// Восстановление меток из localStorage
function restoreMarkers() {
    const savedMarkers = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MARKERS) || '[]');
    savedMarkers.forEach(marker => {
        addCustomMarker(marker);
    });
}

// Вывод списка сохраненных меток в сайдбаре
function renderSavedMarkersList() {
    const listDiv = document.getElementById('savedMarkersList');
    let savedMarkers = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MARKERS) || '[]');
    if (!savedMarkers.length) {
        listDiv.innerHTML = "<p>Метки отсутствуют</p>";
        return;
    }
    listDiv.innerHTML = "";
    savedMarkers.forEach((marker, index) => {
        let markerElem = document.createElement('p');
        markerElem.textContent = marker.name || `Метка ${index + 1}`;
        markerElem.addEventListener('click', () => {
            map.setCenter(marker.coords, 14);
            if (userPosition) {
                createRoute(userPosition, marker.coords);
            }
        });
        listDiv.appendChild(markerElem);
    });
}

// Построение маршрута с использованием метода ymaps.route(), согласно инструкциям к API
function createRoute(startCoords, endCoords) {
    // Если ранее построенный маршрут существует – удаляем его
    if (currentRoute) {
        map.geoObjects.remove(currentRoute);
        currentRoute = null;
    }

    ymaps.route([startCoords, endCoords], { routingMode: 'auto' })
        .then(function (route) {
            currentRoute = route;
            map.geoObjects.add(route);
        })
        .catch(function (error) {
            console.error('Ошибка построения маршрута:', error);
            alert('Не удалось построить маршрут.');
        });
}

// Обработка нажатия кнопки "Построить маршрут" в сайдбаре
function handleRouteButton() {
    let savedMarkers = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.MARKERS) || '[]');
    if (savedMarkers.length && userPosition) {
        let lastMarker = savedMarkers[savedMarkers.length - 1];
        createRoute(userPosition, lastMarker.coords);
    } else {
        alert("Не найдено ни одной метки или не определена геолокация.");
    }
}

// Обработка ошибок геолокации
function handleGeolocationError(error) {
    console.error('Ошибка геолокации:', error);
    alert(`Ошибка получения геолокации: ${error.message}`);
}

// Очистка данных из localStorage и перезагрузка страницы
function clearAllData() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_LOCATION);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.MARKERS);
    location.reload();
}