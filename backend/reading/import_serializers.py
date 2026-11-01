import json

from rest_framework import serializers


class ImportInput(serializers.Serializer):
    source = serializers.FileField(max_length=250)
    book = serializers.CharField(max_length=150, allow_blank=True, default="")
    license = serializers.CharField(max_length=500)
    rights_confirmed = serializers.BooleanField()

    def validate_rights_confirmed(self, value):
        if not value:
            raise serializers.ValidationError(
                "Confirm that you are authorized to use this PDF."
            )
        return value

    def validate_source(self, value):
        if value.size > 50 * 1024 * 1024:
            raise serializers.ValidationError("Upload a PDF of at most 50 MB.")
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Upload a PDF file.")
        return value


class ResolutionInput(serializers.Serializer):
    finding_id = serializers.CharField(max_length=150)
    resolution_note = serializers.CharField(min_length=5, max_length=2000)


class ImportEditInput(serializers.Serializer):
    candidates = serializers.ListField(
        child=serializers.DictField(), max_length=50, required=False
    )
    resolutions = ResolutionInput(many=True, required=False)

    def validate(self, data):
        if len(json.dumps(data)) > 3 * 1024 * 1024:
            raise serializers.ValidationError("The draft is too large.")
        if len(data.get("resolutions", [])) > 500:
            raise serializers.ValidationError("Too many finding resolutions.")
        return data


class ApproveInput(serializers.Serializer):
    candidate_index = serializers.IntegerField(min_value=0, max_value=49)
    confirm_review = serializers.BooleanField()
    confirm_manual_review = serializers.BooleanField(default=False)
