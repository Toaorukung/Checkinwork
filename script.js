$(document).ready(async function () {
    $(document).on('click', '.refreshButton', resetAndRestart);
    $('.refreshButton').hide();
    const LIFF_ID = '2008477909-6KwBjvk4';
    let userProfile = null;
    let watchId = null;
    let locationHistory = [];
    $('.btnGetLocation').hide();
    function logOut(obj) {
        const output = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
        console.log(output);
    }

    function saveLocation(location) {
        locationHistory.push(location);
        if (locationHistory.length > 10) {
            locationHistory.shift();
        }
    }

    try {
        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }

        userProfile = await liff.getProfile();
        $('.name').text(userProfile.displayName);
        $('.imgpro').attr('src', userProfile.pictureUrl);
        checkuser(userProfile.userId);
    } catch (e) {
        logOut('Error: ' + e.message);
    }

    function startLocationTracking() {


        if (!navigator.geolocation) {
            $('.btnGetLocation').show();
            return;
        }

        watchId = navigator.geolocation.watchPosition(
            function (pos) {
                $('.btnGetLocation').hide();

                const location = {
                    user: userProfile ? userProfile.displayName : 'Unknown',
                    userId: userProfile ? userProfile.userId : 'Unknown',
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    altitude: pos.coords.altitude,
                    heading: pos.coords.heading,
                    speed: pos.coords.speed,
                    timestamp: new Date().toISOString()
                };

                saveLocation(location);

                $('.lat').text(location.lat.toFixed(6));
                $('.lng').text(location.lng.toFixed(6));
                window.lat = location.lat.toFixed(6)
                window.lng = location.lng.toFixed(6)
                logOut({
                    current: location,
                    history: locationHistory
                });
            },
            function (error) {
                $('.btnGetLocation').show();

                let errorMsg = '';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = '❌ ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = '❌ ไม่สามารถระบุตำแหน่งได้';
                        break;
                    case error.TIMEOUT:
                        errorMsg = '❌ หมดเวลาในการดึงตำแหน่ง';
                        break;
                    default:
                        errorMsg = '❌ เกิดข้อผิดพลาด: ' + error.message;
                }

                logOut('Error: ' + errorMsg);

                if (error.code === error.PERMISSION_DENIED && watchId) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );

    }

    $('.btnGetLocation').on('click', function () {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }

        locationHistory = [];
        startLocationTracking();
    });

    $(window).on('beforeunload', function () {
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
        }
    });



    const REQUIRED_TIME_MS = 1500;
    const MINIMUM_FACE_WIDTH = 0.4;
    const BLINK_THRESHOLD = 0.6;

    let camera = null;
    let faceLandmarker = null;
    let isCaptured = false;
    let isBlinked = false;
    let faceStartTime = null;

    const $statusEl = $('#status');
    const $video = $('#video');
    const $canvas = $('#canvas');
    const $refreshButton = $('.refreshButton');
    const videoEl = $video[0];
    const canvasEl = $canvas[0];
    $canvas.hide()
    let ctx;
    function getBlendshapeScore(blendshapes, categoryName) {
        const shape = blendshapes.find(s => s.categoryName === categoryName);
        return shape ? shape.score : 0;
    }

    function resetState(message, timerColor = '#60ff6dff') {
        faceStartTime = null;
        $statusEl.text(message);
    }

    function resetAndRestart() {
        if (camera) camera.stop();

        isCaptured = false;
        isBlinked = false;

        $refreshButton.hide();
        $canvas.hide()
        $video.show();

        resetState("⭐ เริ่มต้น Liveness Check ใหม่: กรุณาแสดงใบหน้า");
        startFaceScannerWrapper();
    }


    async function detectAndCapture() {
        if (isCaptured || !videoEl.videoWidth) return;

        const results = faceLandmarker.detectForVideo(videoEl, Date.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const detections = results.faceLandmarks[0];
            const blendshapes = results.faceBlendshapes[0].categories;

            if (!isBlinked) {
                const lBlink = getBlendshapeScore(blendshapes, 'eyeBlinkLeft');
                const rBlink = getBlendshapeScore(blendshapes, 'eyeBlinkRight');

                if (lBlink > BLINK_THRESHOLD && rBlink > BLINK_THRESHOLD) {
                    isBlinked = true;
                    $statusEl.text("⭐ Liveness Check ผ่านแล้ว! จัดใบหน้าในกรอบเพื่อเริ่มสแกน 1.5 วินาที");
                } else {
                    resetState("🟡 กรุณาแสดงใบหน้าในกรอบและ 'กะพริบตาหนึ่งครั้ง'");
                    return;
                }
            }

            if (isBlinked) {
                const faceWidth = detections[359].x - detections[130].x;
                const isFaceLargeEnough = faceWidth > MINIMUM_FACE_WIDTH;

                if (isFaceLargeEnough) {
                    if (!faceStartTime) faceStartTime = Date.now();

                    const elapsed = Date.now() - faceStartTime;
                    const elapsedSeconds = elapsed / 1000;

                    $statusEl.text("🟢 ใบหน้าอยู่ในกรอบ! สแกนต่อเนื่อง...");

                    if (elapsed >= REQUIRED_TIME_MS) {
                        isCaptured = true;

                        canvasEl.width = videoEl.videoWidth;
                        canvasEl.height = videoEl.videoHeight;
                        ctx.translate(canvasEl.width, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        const imgData = canvasEl.toDataURL('image/jpeg', 0.9);
                        $video.hide();
                        window.img = imgData;
                        $canvas.show()
                        $statusEl.text("✅ บันทึกภาพเสร็จสมบูรณ์! แสดงผลภาพที่จับได้แล้ว");
                        $refreshButton.show();

                        resetState("แคปภาพเสร็จสิ้น", '#5cff64ff');

                        if (camera) camera.stop();
                    }
                } else {
                    resetState("🟡 ใบหน้าเล็กเกินไป กรุณาเข้าใกล้มากขึ้น");
                }
            }
        } else {
            const statusMsg = isBlinked
                ? "🔴 ใบหน้าหายไป! กรุณาเริ่ม Liveness Check ใหม่ (กะพริบตา)"
                : "🔴 ไม่พบใบหน้า กรุณาแสดงใบหน้า";

            if (isBlinked) isBlinked = false;
            resetState(statusMsg);
        }
    }

    async function startFaceScannerWrapper() {
        try {
            const { FaceLandmarker, FilesetResolver } = window.mediapipe || await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.js');
            window.mediapipe = { FaceLandmarker, FilesetResolver };

            ctx = canvasEl.getContext('2d');

            if (!faceLandmarker) {
                $statusEl.text("⏳ กำลังโหลดโมเดล Face Landmarker...");
                const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm");
                faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                });
                $statusEl.text("✅ โหลดโมเดลเสร็จสมบูรณ์");
            }

            camera = new Camera(videoEl, {
                onFrame: async () => await detectAndCapture(),
                width: 640,
                height: 360
            });

            camera.start().catch(err => {
                $statusEl.text("🚨 ข้อผิดพลาด: ไม่สามารถเข้าถึงกล้อง");
                console.error("Error starting camera:", err);
            });

        } catch (e) {
            $statusEl.text(`🚨 ข้อผิดพลาดในการโหลด MediaPipe: ${e.message}`);
            console.error("MediaPipe load error:", e);
        }
    }

    $('.save').click(async function (e) {
        e.preventDefault();
        let itemData = await getFormData('home');
        if (!checkvalue(itemData, [])) return;

        if (window.img == null) {
            return Swal.fire({
                icon: 'error',
                title: 'บันทึกไม่สำเร็จ',
                text: 'กรุณาถ่ายภาพเช็คอินก่อนบันทึก',
            });
        }
        itemData.img = window.img;
        itemData.loc = window.loc
        itemData.web = window.web
        itemData.name = window.name
        itemData.uuid = userProfile.userId
        itemData.lat = window.lat
        itemData.lng = window.lng
        console.log(itemData);
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

                        liff.closeWindow();
                    });
                }
                else if (res.status === 'nocheckin') {
                    Swal.fire({
                        icon: 'error',
                        title: res.message,
                        text: res.text,
                        allowOutsideClick: false,
                        confirmButtonText: 'ตกลง',
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
                    //     liff.closeWindow();
                    // });
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
                        window.loc = res.loc
                        window.web = res.web
                        window.name = res.name
                        startLocationTracking();
                        startFaceScannerWrapper();
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
});

