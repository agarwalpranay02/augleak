"""Frozen ImageNet backbones loaded from local timm weights (no network needed)."""
import os
import torch, timm
WEIGHTS = {
    "effnet_b0": ("efficientnet_b0", os.environ.get("AUGLEAK_WEIGHTS", "weights") + "/" + "efficientnet_b0_ra-3dd342df.pth"),
    "densenet121": ("densenet121", os.environ.get("AUGLEAK_WEIGHTS", "weights") + "/" + "densenet121_ra-50efcf5c.pth"),
    "mobilenetv3": ("mobilenetv3_large_100", os.environ.get("AUGLEAK_WEIGHTS", "weights") + "/" + "mobilenetv3_large_100_ra-f55367f5.pth"),
    "effnetv2_b0": ("tf_efficientnetv2_b0", os.environ.get("AUGLEAK_WEIGHTS", "weights") + "/" + "tf_efficientnetv2_b0-c7cc451f.pth"),
}
def load(name):
    arch, path = WEIGHTS[name]
    m = timm.create_model(arch, pretrained=False, num_classes=0)
    sd = torch.load(path, map_location="cpu")
    sd = {k: v for k, v in sd.items() if not k.startswith(("classifier.", "fc.", "head."))}
    missing, unexpected = m.load_state_dict(sd, strict=False)
    assert not missing, (name, missing[:5])
    return m.eval()
