from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("exams", "0001_initial")]
    operations = [
        migrations.AddField(
            model_name="questionset",
            name="presentation",
            field=models.CharField(
                max_length=16,
                choices=[("text", "Interactive text"), ("legacy_pdf", "Legacy PDF")],
                default="legacy_pdf",
            ),
        ),
        migrations.AlterField(
            model_name="questionset",
            name="presentation",
            field=models.CharField(
                max_length=16,
                choices=[("text", "Interactive text"), ("legacy_pdf", "Legacy PDF")],
                default="text",
            ),
        ),
    ]
