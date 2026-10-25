from celery import shared_task

from .test_assembly import build_full_test


@shared_task(
    soft_time_limit=7200, time_limit=7260, acks_late=True, reject_on_worker_lost=True
)
def assemble_listening_test(test_id):
    build_full_test(test_id)
