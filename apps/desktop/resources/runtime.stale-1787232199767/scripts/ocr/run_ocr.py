"""LCOS 本地 OCR 入口：RapidOCR（PaddleOCR ONNX 开源版），纯 CPU 离线。

用法:
  python run_ocr.py <image_path>

输出 JSON:
  {"ok": true, "text": "...", "lines": [{"text": "...", "score": 0.99, "box": [[x,y],...]}], "durationMs": 123}
  {"ok": false, "error": "..."}
"""

import json
import sys
import time
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing image path"}, ensure_ascii=False))
        return 2
    image_path = Path(sys.argv[1])
    if not image_path.is_file():
        print(json.dumps({"ok": False, "error": f"image not found: {image_path}"}, ensure_ascii=False))
        return 2

    # 模型目录优先从环境变量读；否则使用脚本同级 models/（快速启动小包）或
    # rapidocr_onnxruntime 自带权重（完整安装）。
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as error:  # pragma: no cover - 环境缺失时给出可操作报错
        print(json.dumps({"ok": False, "error": f"rapidocr_onnxruntime 未安装: {error}"}, ensure_ascii=False))
        return 3

    started = time.perf_counter()
    try:
        engine = RapidOCR()
        result, _ = engine(str(image_path))
    except Exception as error:  # pragma: no cover
        print(json.dumps({"ok": False, "error": f"OCR 失败: {error}"}, ensure_ascii=False))
        return 1

    duration_ms = int((time.perf_counter() - started) * 1000)
    if not result:
        print(json.dumps({"ok": True, "text": "", "lines": [], "durationMs": duration_ms}, ensure_ascii=False))
        return 0

    lines = [
        {
            "text": str(entry[1]),
            "score": round(float(entry[2]), 4) if len(entry) > 2 and entry[2] is not None else None,
            "box": [[int(x), int(y)] for x, y in entry[0]] if entry[0] else None,
        }
        for entry in result
    ]
    text = "\n".join(line["text"] for line in lines)
    print(json.dumps({"ok": True, "text": text, "lines": lines, "durationMs": duration_ms}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
