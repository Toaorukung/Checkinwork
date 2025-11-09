// =========================================================
// SCRIPT.JS: LIFF Integration and Face Scanner Logic
// =========================================================

// 🔴 ค่าคงที่
const LIFF_ID = "2005980217-El2nJ87G"; // ใช้ ID จริงของคุณ
const REQUIRED_TIME_MS = 1500;
const MINIMUM_FACE_WIDTH = 0.3;

let faceLandmarker;
let camera;

// ---------------------------------------------------------
// 1. ตรรกะ Face Scanner (ปิด Liveness Check)
// ---------------------------------------------------------

async function startFaceScannerWrapper() {
    const $statusEl = $('#status');
    const $fileInputWrapper = $('#fileInputWrapper');

    try {
        // 🔴 Dynamic Import: โหลด MediaPipe Modules
        const { FaceLandmarker, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/vision_bundle.js');

        const $video = $('#video')[0];
        const $canvas = $('#canvas')[0];
        const ctx = $canvas.getContext('2d');
        const $timerEl = $('#timer');
        const $capturedImageEl = $('#capturedImage');
        const $saveButton = $('.save');

        let faceStartTime = null;
        let isCaptured = false;
        let isBlinked = true; // ✅ ปิด Liveness Check โดยตั้งค่าให้ผ่านตั้งแต่เริ่มต้น

        $statusEl.text("⏳ กำลังโหลดโมเดล Face Landmarker...");
        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numFaces: 1
        });
        $statusEl.text("✅ โมเดลโหลดเสร็จสมบูรณ์! จัดใบหน้าในกรอบ...");

        // 🟢 ฟังก์ชันตรวจจับและจับภาพ
        async function detectAndCapture() {
            if (isCaptured) return;
            if (!$video.videoWidth) return;

            const results = faceLandmarker.detectForVideo($video, Date.now());

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const detections = results.faceLandmarks[0];

                // ตรรกะ: ตรวจสอบขนาดใบหน้าและเริ่มสแกน 1.5 วินาทีทันที
                const faceWidth = detections[359].x - detections[130].x;
                const isFaceLargeEnough = faceWidth > MINIMUM_FACE_WIDTH;

                if (isFaceLargeEnough) {
                    if (!faceStartTime) faceStartTime = Date.now();

                    const elapsed = Date.now() - faceStartTime;
                    const elapsedSeconds = elapsed / 1000;

                    $timerEl.text(`${elapsedSeconds.toFixed(2)} วินาที`);
                    $statusEl.text("🟢 ใบหน้าอยู่ในกรอบ! สแกนต่อเนื่อง...");

                    if (elapsed >= REQUIRED_TIME_MS) {
                        isCaptured = true;
                        $saveButton.prop('disabled', false); // เปิดปุ่มบันทึก

                        // 3. จับภาพ
                        $canvas.width = $video.offsetWidth;
                        $canvas.height = $video.offsetHeight;

                        ctx.drawImage($video, 0, 0, $canvas.width, $canvas.height);
                        const imgData = $canvas.toDataURL('image/jpeg', 0.9); // 🔴 รูปภาพ Base64

                        // 🔴 แสดงผลภาพที่จับได้
                        $capturedImageEl.attr('src', imgData).removeClass('d-none').show();
                        $($video).hide();
                        $('.video-container').hide();
                        $fileInputWrapper.hide(); // ซ่อนส่วนแนบไฟล์
                        
                        $statusEl.text("✅ บันทึกภาพเสร็จสมบูรณ์!");
                        $timerEl.css('color', '#c0392b');

                        if (camera) camera.stop();
                    }
                } else {
                    faceStartTime = null;
                    $timerEl.text("0.00 วินาที");
                    $statusEl.text("🟡 ใบหน้าเล็กเกินไป กรุณาเข้าใกล้มากขึ้น");
                }

            } else {
                faceStartTime = null;
                $timerEl.text("0.00 วินาที");
                $saveButton.prop('disabled', true);
                $statusEl.text("🔴 ไม่พบใบหน้า กรุณาแสดงใบหน้า");
            }
        }

        // 4. เริ่มกล้องและลูปการตรวจจับ
        camera = new Camera($video, {
            onFrame: async () => {
                await detectAndCapture();
            },
            width: 1280,
            height: 720
        });

        camera.start().catch(err => {
            $statusEl.text("🚨 ข้อผิดพลาด: ไม่สามารถเข้าถึงกล้อง! กรุณาแนบภาพเช็คอินด้วยตนเอง");
            console.error("Error starting camera:", err);
            
            // 🟢 เปิดส่วนแนบไฟล์เมื่อกล้องใช้งานไม่ได้
            $('.video-container').hide();
            $fileInputWrapper.removeClass('d-none').show();
            $saveButton.prop('disabled', false); // เปิดปุ่มบันทึกเพื่อให้ผู้ใช้แนบและบันทึกได้
        });

    } catch (e) {
        $statusEl.text(`🚨 ข้อผิดพลาดในการโหลด MediaPipe: ${e.message}`);
        console.error("MediaPipe load error:", e);
    }
}


// ---------------------------------------------------------
// 2. ตรรกะ LIFF และ User Profile
// ---------------------------------------------------------

$(document).ready(function () {
    initializeLiff()
});

// 🔴 แก้ไข: รวมฟังก์ชัน initializeLiff ที่ซ้ำซ้อนเข้าด้วยกัน
async function initializeLiff() {
    const $statusEl = $('#status');
    try {
        await liff.init({ liffId: LIFF_ID })

        if (liff.isLoggedIn()) {
            $statusEl.text("✅ LIFF Ready! กำลังดึงข้อมูลผู้ใช้...");
            getUserProfile()
        } else {
            // $statusEl.text("🚨 LIFF SDK ไม่พร้อมใช้งาน (ไม่ได้เปิดใน LINE หรือโหลดไม่สำเร็จ)"); // ลบข้อความนี้เพราะ LIFF กำลังจะ Login
            liff.login()
        }
    } catch (error) {
        $statusEl.text(`🚨 LIFF Initialization failed. Error: ${error.message}`);
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


// ---------------------------------------------------------
// 3. ตรรกะ API Call และ UI Management (เหมือนเดิม)
// ---------------------------------------------------------

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
                    
                    // 🟢 เริ่ม Face Scanner หลัง checkuser สำเร็จ
                    startFaceScannerWrapper() 
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


$('.save').click(async function (e) {
    e.preventDefault();
    
    let itemData = await getFormData('home');
    
    // 🔴 เพิ่ม: ดึง Base64 Image Data ที่ได้จากการสแกนใบหน้า
    const scannedImageData = $('#capturedImage').attr('src'); 

    // หากมีการสแกนสำเร็จ ให้ใส่ Base64 Image Data ลงใน itemData
    if (scannedImageData && scannedImageData.startsWith('data:image/jpeg')) {
        itemData.imgBase64 = scannedImageData;
    }


    if (!checkvalue(itemData, [])) return;

    let distStr = $('.checklo').val().trim();
    let dist = parseFloat(distStr);

    let isKm = distStr.endsWith(' กม.');
    let isM = distStr.endsWith(' ม.');
    if (isKm && !isM && dist >= 20) {
        try {
            let allowed = await checkIP();
            if (!allowed) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'ยังไม่ถึงจุดเช็คอิน',
                    text: `กรุณาเดินไปยังจุดเช็คอินก่อนบันทึก`,
                });
            }
        } catch (err) {
            console.error('เช็ค IP ผิดพลาด:', err);
        }
    }

    // 🔴 แก้ไข: ตรวจสอบว่ามีการสแกนใบหน้าสำเร็จ หรือแนบไฟล์ด้วยตนเอง
    if (!itemData.imgBase64 && $('#img')[0].files.length === 0) {
        return Swal.fire({
            icon: 'error',
            title: 'บันทึกไม่สำเร็จ',
            text: 'กรุณาถ่ายภาพเช็คอิน หรือแนบภาพด้วยตนเอง',
        });
    }
    
    // ถ้ามีการแนบไฟล์ด้วยตนเอง ให้ใช้ไฟล์นั้นแทน
    if ($('#img')[0].files.length > 0) {
        // ⚠️ โค้ดนี้ต้องแปลงไฟล์เป็น Base64 ก่อนส่ง ถ้า API ต้องการ Base64
        // เนื่องจากไม่มีโค้ดแปลงไฟล์ในฟังก์ชันนี้ คุณอาจต้องเพิ่ม
        // สำหรับตอนนี้ ให้ใช้ itemData ปกติ และเซิร์ฟเวอร์ต้องจัดการ multipart/form-data
        console.log("Using uploaded file instead of scanned image.");
    }

    console.log(itemData);
    savecheckin(itemData);
});


function savecheckin(itemData) {
    showhidepage('header')
    callApi('savecheckin', itemData) // itemData ตอนนี้อาจมี itemData.imgBase64
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
                    let message = {
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