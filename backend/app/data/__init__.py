from app.data.policies import load_policies


def load_test_policies():
    return load_policies("test")

__all__ = ["load_policies", "load_test_policies"]
