const CHECKIN_LOCATIONS = [
    { lat: 20.448406, lng: 99.886832, name: 'จุดเช็คอิน A' },
    { lat: 17.885554, lng: 102.709927, name: 'จุดเช็คอิน B' }
];
const ORS_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjczODA0MWEyMGZmMTQzZjU5NGM1NzQwMzNkODg3ZGI4IiwiaCI6Im11cm11cjY0In0=';

$(() => {
    showhidepage('header')
    initializeLiff()
    async function initializeLiff() {
        try {
            await liff.init({ liffId: "2005980217-El2nJ87G" })
            if (liff.isLoggedIn()) {
                getUserProfile()
            } else {
                liff.login()
            }
        } catch (error) {
            console.error('LIFF Initialization failed', error)
        }
    }

    async function getUserProfile() {
        try {
            let profile = await liff.getProfile()
            let uid = profile.userId
            $('#home').data('uuid', uid);
            $('.imgpro').attr('src', profile.pictureUrl)
            localStorage.setItem('pictureUrl', profile.pictureUrl);
            $('.name').text(profile.displayName)
            $('.home').data('uuid', uid);
            checkuser(uid)
        } catch (error) {
            console.error('Failed to get profile', error)
            $('#profile').text('Failed to get profile')
        }
    }
})

function checkuser(uuid) {
    showhidepage('header')
    callApi('checkuser', { "uuid": uuid })
        .then(res => {
            if (res.status === 'success') {
                Swal.fire({
                    title: res.message,
                    text: res.text,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    showhidepage('.home');
                    $('.home').data('loc', res.loc);
                    $('.home').data('web', res.web);
                    $('.home').data('name', res.name);
                    setlocation()
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: res.message,
                    text: res.text,
                    allowOutsideClick: false,
                    confirmButtonText: 'ตกลง',
                }).then(() => {
                    showhidepage('header');
                });
            }
        })
        .catch(() => {
            showhidepage('header');
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
                allowOutsideClick: false,
                confirmButtonText: 'ตกลง',
            });
        });
}

$(async function () {
    let video = document.getElementById('video');
    let $videoCont = $('.video-container');
    let $capture = $('#btn-capture');
    let $retake = $('#btn-retake');
    let $retry = $('#btn-retry');
    let $preview = $('.capture-preview');
    let $input = $('#img')[0];

    function startCamera() {
        $capture.addClass('d-none');
        $retake.addClass('d-none');
        $retry.addClass('d-none');
        $preview.addClass('d-none');
        $videoCont.removeClass('d-none');

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "user" } },
            audio: false
        })
            .then(stream => {
                video.srcObject = stream;
                $capture.removeClass('d-none');
            })

            .catch(err => {
                console.error(err);
                $capture.addClass('d-none');

                let msg = 'ไม่สามารถเข้าถึงกล้องได้';
                if (err.name === 'NotAllowedError') msg = 'กรุณาอนุญาตกล้อง';
                else if (err.name === 'NotFoundError') msg = 'ไม่พบกล้องในอุปกรณ์นี้';
                else if (err.name === 'NotReadableError') msg = 'กล้องอาจถูกใช้งานอยู่';

                Swal.fire({
                    icon: 'error',
                    title: 'เกิดข้อผิดพลาด',
                    text: msg,
                    confirmButtonText: 'ลองอีกครั้ง'
                }).then(() => $retry.removeClass('d-none'));
            });
    }

    function captureImage() {
        let canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        let ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(blob => {
            let file = new File([blob], 'capture.png', { type: 'image/png' });
            let dt = new DataTransfer();
            dt.items.add(file);
            $input.files = dt.files;

            let url = URL.createObjectURL(file);
            $preview.attr('src', url).removeClass('d-none');
            $videoCont.addClass('d-none');
            $capture.addClass('d-none');
            $retake.removeClass('d-none');
        }, 'image/png');
    }

    startCamera();

    $capture.on('click', captureImage);
    $retake.on('click', startCamera);
    $retry.on('click', startCamera);
});

function setlocation() {
    console.log('เริ่มฟังก์ชัน setlocation');

    if (!navigator.geolocation) {
        console.log('ตรวจสอบ Geolocation: ไม่รองรับ');
        return alert('เบราว์เซอร์ไม่รองรับ Geolocation');
    }
    console.log('ตรวจสอบ Geolocation: รองรับ');

    console.log('กำลังสร้างแผนที่ที่ตำแหน่ง [20.45, 99.89], zoom 8');
    const map = L.map('map').setView([20.45, 99.89], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    console.log('เพิ่ม tile layer เรียบร้อย');

    console.log('สร้างไอคอน userIcon');
    const userIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });
    console.log('เพิ่ม marker เริ่มต้นที่ [0,0]');
    const currentMarker = L.marker([0, 0], { icon: userIcon }).addTo(map);

    console.log('สร้างไอคอน checkIcon');
    const checkIcon = L.icon({
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });
    console.log('เพิ่ม checkin marker เริ่มต้นที่ [0,0]');
    const checkinMarker = L.marker([0, 0], { icon: checkIcon }).addTo(map);

    function findNearest(latlng) {
        console.log('เรียกใช้ findNearest กับตำแหน่ง', latlng);
        let nearest = CHECKIN_LOCATIONS[0];
        let minD = latlng.distanceTo([nearest.lat, nearest.lng]);
        for (let loc of CHECKIN_LOCATIONS) {
            const d = latlng.distanceTo([loc.lat, loc.lng]);
            if (d < minD) {
                minD = d;
                nearest = loc;
            }
        }
        console.log('พบจุดที่ใกล้ที่สุด:', nearest, 'ระยะทาง', minD);
        return nearest;
    }

    console.log('กำลังขอ location ครั้งแรกด้วย getCurrentPosition');
    navigator.geolocation.getCurrentPosition(pos => {
        console.log('getCurrentPosition สำเร็จ:', pos.coords);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const userLatLng = L.latLng(lat, lng);

        console.log('อัปเดต currentMarker ไปที่', userLatLng);
        currentMarker.setLatLng(userLatLng).openPopup();
        console.log('ตั้ง view ของแผนที่ไปที่', userLatLng, 'zoom 15');
        map.setView(userLatLng, 15);

        startWatch();
    }, err => {
        console.warn('getCurrentPosition ล้มเหลว:', err);
        console.log('ยังคงเรียก startWatch ต่อ');
        startWatch();
    }, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    });

    function startWatch() {
        console.log('เริ่ม watchPosition');
        navigator.geolocation.watchPosition(async pos => {
            console.log('watchPosition success:', pos.coords);
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const userLatLng = L.latLng(lat, lng);

            console.log('อัปเดตฟิลด์ #lat, #lng');
            $('#lat').val(lat);
            $('#lng').val(lng);

            console.log('อัปเดต currentMarker ไปที่', userLatLng);
            currentMarker.setLatLng(userLatLng);

            const nearest = findNearest(userLatLng);
            const checkLatLng = L.latLng(nearest.lat, nearest.lng);
            console.log('อัปเดต checkinMarker ไปที่', checkLatLng);
            checkinMarker.setLatLng(checkLatLng);

            const orsUrl = `https://api.openrouteservice.org/v2/directions/driving-car` +
                `?api_key=${ORS_API_KEY}` +
                `&start=${lng},${lat}` +
                `&end=${nearest.lng},${nearest.lat}`;
            console.log('เรียก ORS API ด้วย URL:', orsUrl);

            try {
                const resp = await fetch(orsUrl);
                console.log('ORS response status:', resp.status);
                const data = await resp.json();
                console.log('ORS response JSON:', data);

                if (data.features?.length) {
                    const coords = data.features[0].geometry.coordinates.map(c => [c[1], c[0]]);
                    if (!window.routeLine) {
                        console.log('สร้าง polyline ใหม่');
                        window.routeLine = L.polyline(coords, { weight: 4, color: 'blue' }).addTo(map);
                    } else {
                        console.log('อัปเดต polyline เดิม');
                        window.routeLine.setLatLngs(coords);
                    }
                    const dist = data.features[0].properties.segments[0].distance;
                    const txt = dist >= 1000
                        ? (dist / 1000).toFixed(2) + ' กม.'
                        : dist.toFixed(2) + ' ม.';
                    console.log('คำนวณระยะทาง:', txt);
                    $('.checklo').val(txt);
                } else {
                    console.log('ไม่มี feature ใดๆ ใน ORS response');
                }
            } catch (e) {
                console.error('เกิดข้อผิดพลาด ORS:', e);
            }
        }, err => {
            console.warn('watchPosition error:', err);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    }

    console.log('ตั้ง ResizeObserver เพื่อ invalidateSize ให้ map');
    new ResizeObserver(() => {
        console.log('ResizeObserver เหตุการณ์ resize - invalidateSize map');
        map.invalidateSize();
    }).observe(document.querySelector('.ratio'));
}

$('.save').click(async function (e) {
    e.preventDefault();
    const itemData = await getFormData('home');
    if (!checkvalue(itemData, [])) return;

    const distStr = $('.checklo').val().trim();
    const dist = parseFloat(distStr);

    const isKm = distStr.endsWith(' กม.');
    const isM = distStr.endsWith(' ม.');

    if (isKm || (isM && dist > 1)) {
        try {
            const allowed = await checkIP();
            if (!allowed) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'ยังไม่ถึงจุดเช็คอิน',
                    text: 'กรุณาเดินไปยังจุดเช็คอินก่อนบันทึก',
                });
            }
        } catch (err) {
            console.error('เช็ค IP ผิดพลาด:', err);
            return Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถตรวจสอบสิทธิ์ IP ได้',
            });
        }
    }

    if ($('#img')[0].files.length === 0) {
        return Swal.fire({
            icon: 'error',
            title: 'บันทึกไม่สำเร็จ',
            text: 'กรุณาถ่ายภาพเช็คอินก่อนบันทึก',
        });
    }
    savecheckin(itemData);
});

function savecheckin(itemData) {
    showhidepage('header')
    callApi('savecheckin', itemData)
        .then(res => {
            if (res.status === 'success') {
                Swal.fire({
                    title: res.message,
                    text: res.text,
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    let flex = {
                        type: 'flex',
                        altText: 'บันทึกเข้างานเรียบร้อย',
                        contents: {
                            "type": "bubble",
                            "body": {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    {
                                        "type": "image",
                                        "size": "full",
                                        "aspectRatio": "2:1",
                                        "flex": 1,
                                        "animated": true,
                                        "url": "https://community.akamai.steamstatic.com/economy/profilebackground/items/2861690/6afa7adf514fb727c292a18974fe215a0bb11be6.jpg",
                                        "gravity": "center",
                                        "aspectMode": "cover"
                                    },
                                    {
                                        "type": "box",
                                        "layout": "horizontal",
                                        "contents": [
                                            {
                                                "type": "box",
                                                "layout": "vertical",
                                                "contents": [
                                                    {
                                                        "type": "image",
                                                        "url": localStorage.getItem('pictureUrl'),
                                                        "aspectMode": "cover",
                                                        "size": "full"
                                                    },
                                                    {
                                                        "type": "image",
                                                        "url": "https://cdn.akamai.steamstatic.com/steamcommunity/public/images/items/2861690/396aa5ec2a44df7548ffa2bcc5383eef91095a4b.png",
                                                        "aspectMode": "cover",
                                                        "size": "full",
                                                        "position": "absolute",
                                                        "animated": true
                                                    }
                                                ],
                                                "cornerRadius": "100px",
                                                "width": "100px",
                                                "height": "100px"
                                            },
                                            {
                                                "type": "box",
                                                "layout": "vertical",
                                                "contents": [
                                                    {
                                                        "type": "text",
                                                        "text": "บันทึกเข้างานเสร็จสิ้น",
                                                        "wrap": true,
                                                        "weight": "bold",
                                                        "size": "sm",
                                                        "color": "#FFD027",
                                                        "align": "center"
                                                    },
                                                    {
                                                        "type": "text",
                                                        "text": "Time : " + res.time,
                                                        "wrap": true,
                                                        "weight": "bold",
                                                        "size": "sm",
                                                        "color": "#FFD027"
                                                    },
                                                    {
                                                        "type": "text",
                                                        "text": "Web : " + res.web,
                                                        "wrap": true,
                                                        "weight": "bold",
                                                        "size": "sm",
                                                        "color": "#FFD027"
                                                    }
                                                ],
                                                "backgroundColor": "#162C9acc",
                                                "cornerRadius": "10px",
                                                "margin": "10px",
                                                "paddingAll": "5px",
                                                "spacing": "xs"
                                            }
                                        ],
                                        "spacing": "xl",
                                        "position": "absolute",
                                        "paddingAll": "20px"
                                    }
                                ],
                                "paddingAll": "0px"
                            }
                        }
                    };
                    if (liff.isInClient()) {
                        liff.sendMessages([flex])
                            .then(() => liff.closeWindow())
                            .catch(err => console.error('sendMessages failed:', err));
                    } else {
                        liff.shareTargetPicker([flex])
                            .then(() => console.log('shared flex via picker'))
                            .catch(err => console.error('shareTargetPicker failed:', err));
                    }

                });
            } else if (res.status === 'nocheckin') {
                Swal.fire({
                    icon: 'error',
                    title: res.message,
                    text: res.text,
                    allowOutsideClick: false,
                    confirmButtonText: 'ตกลง',
                }).then(() => {
                    const message = {
                        type: 'text',
                        text: 'เลิกงาน'
                    };

                    if (liff.isInClient() && liff.isApiAvailable('sendMessages')) {
                        liff.sendMessages([message])
                            .then(() => {
                                liff.closeWindow();
                            })
                            .catch(error => {
                                console.error('เกิดข้อผิดพลาดในการส่งข้อความ:', error);
                                liff.closeWindow();
                            });
                    } else if (liff.isApiAvailable('shareTargetPicker')) {
                        liff.shareTargetPicker([message])
                            .then(() => {
                                console.log('แชร์ข้อความผ่าน picker เรียบร้อย');
                            })
                            .catch(error => {
                                console.error('แชร์ผ่าน picker ล้มเหลว:', error);
                            });
                    } else {
                    }

                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: res.message,
                    text: res.text,
                    allowOutsideClick: false,
                    confirmButtonText: 'ตกลง',
                }).then(() => {
                    liff.closeWindow();
                    window.location.reload();
                }).catch((error) => {
                    console.error('เกิดข้อผิดพลาดในการส่งข้อความ:', error);
                    liff.closeWindow();
                });
            }
        })
        .catch(() => {
            showhidepage('.home');
            Swal.fire({
                icon: 'error',
                title: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
                allowOutsideClick: false,
                confirmButtonText: 'ตกลง',
            });
        });
}

async function checkIP() {
    try {
        const resp = await fetch('https://api.ipify.org?format=json');
        if (!resp.ok) {
            console.error('Fetch failed:', resp.status);
            throw new Error('ไม่สามารถดึงข้อมูล IP ได้ (HTTP ' + resp.status + ')');
        }

        const { ip: userIP } = await resp.json();
        const allowedIPs = [
            '103.43.76.93',
        ];

        // const loc = $('.home').data('loc');
        // if (loc === 'ไทย') {
        // }
        allowedIPs.push(userIP);

        return allowedIPs.includes(userIP);
    } catch (err) {
        console.error('Error in checkIP():', err);
        throw new Error('ไม่สามารถดึงข้อมูล IP ได้');
    }
}
