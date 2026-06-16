import PerspectiveCropper from "./PerspectiveCropper";

/*
  Step 1 (Image): straighten the captured photo. The cropper keeps its own
  image-specific controls (Manual Fix / Auto Detect, Retake / Next) since they
  act on the image directly. onCropped advances to step 2 with the flattened
  data URL; onClose discards.
*/
export default function CaptureStep({ imageUrl, onCropped, onClose }) {
  return (
    <PerspectiveCropper
      imageUrl={imageUrl}
      onConfirm={onCropped}
      onSkip={onCropped}
      onRetake={onClose}
    />
  );
}
