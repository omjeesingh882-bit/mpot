// Generate a 4 digit OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const sendOTP = (contact, otp) => {
    // Mock sending OTP logic
    console.log(`\n========================================`);
    console.log(`[MOCK OTP SERVICE]`);
    console.log(`Sending OTP: ${otp} to: ${contact}`);
    console.log(`========================================\n`);
};

module.exports = {
    generateOTP,
    sendOTP
};
