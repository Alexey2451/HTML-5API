const storageKey = 'userMarkers';
let map;
let userPosition;
let markers = JSON.parse(localStorage.getItem(storageKey)) || [];

// Инициализация карты
ymaps.ready(init);

function init() {
    // Инициализация карты с элементами управления
    map = new ymaps.Map("map", {
        center: [55.751244, 37.618423], // Центр карты: Москва
        zoom: 10,
        controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
    });

    // Настройка элементов управления
    map.controls.get('zoomControl').options.set({ size: 'small' });

    // Восстановление сохраненных маркеров
    restoreMarkers();

    // Определение геопозиции
    document.getElementById('geoButton').addEventListener('click', async () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (position) => {
                userPosition = [position.coords.latitude, position.coords.longitude];
                map.setCenter(userPosition, 14);

                // Маркер для текущего местоположения
                addMarker(userPosition, 'Ваше местоположение', 'Вы здесь.');
                saveMarkers();
            }, () => {
                alert("Не удалось определить местоположение. Проверьте настройки.");
            });
        } else {
            alert("Геолокация не поддерживается вашим браузером.");
        }
    });

    // Очистка данных из LocalStorage
    document.getElementById('clearStorageButton').addEventListener('click', () => {
        localStorage.removeItem(storageKey);
        location.reload();
    });

    // Поиск достопримечательностей
    document.getElementById('addPlacesButton').addEventListener('click', async () => {
        if (!userPosition) {
            alert("Сначала определите ваше местоположение.");
            return;
        }
        const places = await fetchPlaces(userPosition);
        for (const { name, lat, lon } of places) {
            addMarker([lat, lon], name, 'Интересное место.');
        }
    });

    // Клик на карту для построения маршрута
    map.events.add('click', (event) => {
        const targetCoords = event.get('coords');
        if (userPosition) {
            buildRoute(userPosition, targetCoords);
        } else {
            alert("Сначала определите своё местоположение.");
        }
    });
}

// Добавление маркера
function addMarker(coords, name, description) {
    const placemark = new ymaps.Placemark(coords, {
        balloonContent: `
            <strong>${name}</strong><br>
            Описание: ${description}<br>
            Дата добавления: ${new Date().toLocaleString()}
        `
    }, {
        iconLayout: 'default#image',
        iconImageHref: 'https://cdn-icons-png.flaticon.com/512/252/252025.png',
        iconImageSize: [30, 42],
        iconImageOffset: [-15, -42]
    });

    map.geoObjects.add(placemark);

    placemark.events.add('click', () => {
        if (userPosition) {
            buildRoute(userPosition, coords);
        }
    });

    markers.push({ coords, name, description });
    saveMarkers();
}

// Восстановление маркеров из localStorage
function restoreMarkers() {
    const clusterer = new ymaps.Clusterer({
        preset: 'islands#invertedVioletClusterIcons',
        groupByCoordinates: true
    });

    markers.forEach(({ coords, name, description }) => {
        const placemark = new ymaps.Placemark(coords, {
            balloonContent: `
                <strong>${name}</strong><br>
                Описание: ${description}<br>
            `
        }, {
            iconLayout: 'default#image',
            iconImageHref: 'https://cdn-icons-png.flaticon.com/512/252/252025.png',
            iconImageSize: [30, 42],
            iconImageOffset: [-15, -42]
        });

        clusterer.add(placemark);
    });

    map.geoObjects.add(clusterer);
}

// Построение маршрута
function buildRoute(startCoords, endCoords) {
    const route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [startCoords, endCoords],
        params: {
            routingMode: 'auto'
        }
    });

    map.geoObjects.add(route);
}

// Сохранение данных в localStorage
function saveMarkers() {
    localStorage.setItem(storageKey, JSON.stringify(markers));
}

// Имитированный запрос на получение достопримечательностей
async function fetchPlaces([lat, lon]) {
    return [
        { name: "Красная площадь", lat: 55.753908, lon: 37.620935 },
        { name: "Большой театр", lat: 55.760223, lon: 37.618697 },
        { name: "Парк Горького", lat: 55.729641, lon: 37.603264 }
    ];
}