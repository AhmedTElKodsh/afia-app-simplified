import onnx
from onnx import helper, TensorProto, numpy_helper
import numpy as np

W = np.random.randn(4, 1).astype(np.float32)
b = np.random.randn(1).astype(np.float32)

graph_def = helper.make_graph(
    nodes=[
        helper.make_node("MatMul", inputs=["input", "W"], outputs=["product"]),
        helper.make_node("Add", inputs=["product", "b"], outputs=["output"]),
    ],
    name="regression-model",
    inputs=[helper.make_tensor_value_info("input", TensorProto.FLOAT, [1, 4])],
    outputs=[helper.make_tensor_value_info("output", TensorProto.FLOAT, [1, 1])],
    initializer=[
        numpy_helper.from_array(W, name="W"),
        numpy_helper.from_array(b, name="b"),
    ],
)
model_def = helper.make_model(graph_def, producer_name="afia-spike")
model_def.opset_import[0].version = 18

onnx.save(model_def, "worker/src/onnx/models/regression.onnx")
size = len(open("worker/src/onnx/models/regression.onnx", "rb").read())
print(f"Regression model saved: {size} bytes")
