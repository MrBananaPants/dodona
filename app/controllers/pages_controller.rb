class PagesController < ApplicationController
  content_security_policy only: %i[contact create_contact] do |policy|
    policy.script_src(*(%w[https://hcaptcha.com https://*.hcaptcha.com] + policy.script_src))
    policy.style_src(*(%w[https://hcaptcha.com https://*.hcaptcha.com] + policy.style_src))
    policy.connect_src(*(%w[https://hcaptcha.com https://*.hcaptcha.com] + policy.connect_src))
    policy.frame_src('https://hcaptcha.com', 'https://*.hcaptcha.com')
  end

  def home
    @title = 'Home'
    @crumbs = []
    if current_user
      @recent_exercises = current_user.recent_exercises(5)
      ActivityStatus.add_status_for_user_and_activities(current_user, @recent_exercises, [last_submission: [:course]])

      course_memberships = current_user.course_memberships.includes(course: %i[institution series]).select(&:subscribed?)
      @subscribed_courses = course_memberships.map(&:course)
      @favorite_courses = course_memberships.select(&:favorite).map(&:course)
      @grouped_courses = @subscribed_courses.sort_by(&:year).reverse.group_by(&:year)
      @homepage_series = @subscribed_courses.map { |c| c.homepage_series(0) }.flatten.sort_by(&:deadline)

      @jump_back_in = jump_back_in
    else
      set_metrics
      respond_to do |format|
        format.html { render :static_home }
        format.json { render partial: 'static_home' }
      end
    end
  end

  def jump_back_in
    latest_submission = current_user.submissions.first
    return nil if latest_submission.nil?

    result = {
      submission: nil,
      activity: nil,
      series: nil,
      course: latest_submission.course
    }

    unless latest_submission.accepted?
      # The last submission was wrong, continue working on it
      result[:submission] = latest_submission
      result[:activity] = latest_submission.exercise
      result[:series] = latest_submission.series
      return result
    end

    # The last submission was correct, start working on the next exercise
    if latest_submission.series.nil?
      # we don't know the series, thus have no idea what the next exercise is, continue working on the course
      return result
    end

    next_activity = latest_submission.series.next_activity(latest_submission.exercise)
    unless next_activity.nil?
      # start working on the next exercise
      result[:activity] = next_activity
      result[:series] = latest_submission.series
      return result
    end

    # There is no next exercise, start working on the next series
    next_series = latest_submission.series.next
    if next_series.nil?
      # there is no next series, continue working on the course
      return result
    end

    # start working on the next series
    result[:series] = next_series
    result
  end

  def institution_not_supported; end

  def about
    set_metrics
  end

  def data; end

  def privacy; end

  def support
    set_metrics
  end

  def toggle_demo_mode
    authorize :pages
    session[:demo] = !Current.demo_mode
  end

  def toggle_dark_mode
    authorize :pages
    session[:dark] = params[:dark].nil? ? !session[:dark] : ActiveModel::Type::Boolean.new.cast(params[:dark])
  end

  def contact
    @contact_form = ContactForm.new
    @title = I18n.t('pages.contact.title')
  end

  def create_contact
    if /xevil/i =~ contact_params[:message]
      redirect_to root_path
      return
    end

    @contact_form = ContactForm.new(contact_params)
    @contact_form.request = request # Allows us to also send ip
    @contact_form.validate
    if verify_hcaptcha(model: @contact_form, message: t('.captcha_failed')) && @contact_form.deliver
      redirect_to root_path, notice: t('.mail_sent')
    else
      flash.now[:error] = @contact_form.errors.full_messages.to_sentence
      render :contact
    end
  end

  def profile
    authorize :pages
    redirect_to user_path(current_user)
  end

  private

  def contact_params
    params.require(:contact_form)
          .merge(dodona_user: current_user&.inspect)
  end

  def set_metrics
    @total_submissions = Submission.order(id: :desc).limit(1).pick(:id)
    @total_users = User.order(id: :desc).limit(1).pick(:id)
    @total_activities = Activity.count
    @total_schools = Institution.order(id: :desc).limit(1).pick(:id)
  end
end
